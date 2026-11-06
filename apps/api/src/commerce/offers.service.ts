import { Inject, Injectable } from "@nestjs/common";
import type { z } from "zod";
import type {
  AdInput,
  AdminAdSchema,
  AdminOfferSchema,
  OfferInput,
  PublicAdSchema,
} from "@pegah/contracts";
import { Prisma } from "@pegah/db";
import { AuditService } from "../audit/audit.service";
import type { AuthContext } from "../auth/auth.types";
import type { Tx } from "../booking/inventory";
import { newPublicId } from "../common/ids";
import { toMoney } from "../common/money";
import { ProblemException } from "../common/problem";
import { APP_CONFIG, type AppConfig } from "../config/config";
import { PRISMA, type Db } from "../prisma/prisma.service";

const MEDIA = { select: { storageKey: true, altText: true } } as const;
const OFFER_INCLUDE = { hero: MEDIA } satisfies Prisma.OfferInclude;
const AD_INCLUDE = { media: MEDIA } satisfies Prisma.AdInclude;
type OfferRow = Prisma.OfferGetPayload<{ include: typeof OFFER_INCLUDE }>;
type AdRow = Prisma.AdGetPayload<{ include: typeof AD_INCLUDE }>;

/** Offers (packages sold directly) and ads (scheduled banners), ADR-0032. */
@Injectable()
export class OffersService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private ref(m: { storageKey: string; altText: string } | null) {
    if (!m) return null;
    return {
      key: m.storageKey,
      url: `${this.config.MEDIA_BASE_URL.replace(/\/$/, "")}/${m.storageKey}`,
      alt: m.altText,
    };
  }

  private offerView(o: OfferRow, now: Date): z.infer<typeof AdminOfferSchema> {
    const remaining = o.stock === null ? null : Math.max(0, o.stock - o.sold);
    return {
      id: o.publicId,
      slug: o.slug,
      titleEn: o.titleEn,
      titleBn: o.titleBn,
      summaryEn: o.summaryEn,
      summaryBn: o.summaryBn,
      detailsEn: o.detailsEn,
      detailsBn: o.detailsBn,
      price: toMoney(o.priceMinor, o.currency),
      originalPrice: o.originalPriceMinor ? toMoney(o.originalPriceMinor, o.currency) : null,
      hero: this.ref(o.hero),
      validUntil: o.validUntil?.toISOString() ?? null,
      remaining,
      available:
        o.status === "PUBLISHED" &&
        (remaining === null || remaining > 0) &&
        (!o.validUntil || o.validUntil > now),
      status: o.status,
      stock: o.stock,
      sold: o.sold,
      sortOrder: o.sortOrder,
      updatedAt: o.updatedAt.toISOString(),
    };
  }

  private toPublicOffer(o: OfferRow, now: Date) {
    const {
      status: _s,
      stock: _st,
      sold: _so,
      sortOrder: _o,
      updatedAt: _u,
      ...rest
    } = this.offerView(o, now);
    void [_s, _st, _so, _o, _u];
    return rest;
  }

  // ── Public ────────────────────────────────────────────────────────────────

  async publicOffers(now: Date = new Date()) {
    const rows = await this.db.offer.findMany({
      where: { status: "PUBLISHED", OR: [{ validUntil: null }, { validUntil: { gt: now } }] },
      orderBy: [{ sortOrder: "asc" }, { id: "desc" }],
      include: OFFER_INCLUDE,
    });
    return {
      items: rows.map((o) => {
        const { detailsEn: _e, detailsBn: _b, ...card } = this.toPublicOffer(o, now);
        void [_e, _b];
        return card;
      }),
    };
  }

  async publicOffer(slug: string, now: Date = new Date()) {
    const o = await this.db.offer.findFirst({
      where: { slug, status: "PUBLISHED" },
      include: OFFER_INCLUDE,
    });
    if (!o) throw new ProblemException(404, "offer-not-found", "Offer not found");
    return this.toPublicOffer(o, now);
  }

  async liveAds(
    placement: AdRow["placement"],
    now: Date = new Date(),
  ): Promise<{ items: z.infer<typeof PublicAdSchema>[] }> {
    const rows = await this.db.ad.findMany({
      where: {
        placement,
        active: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
        ],
      },
      orderBy: [{ sortOrder: "asc" }, { id: "desc" }],
      take: 6,
      include: AD_INCLUDE,
    });
    return { items: rows.map((a) => this.publicAd(a)) };
  }

  private publicAd(a: AdRow): z.infer<typeof PublicAdSchema> {
    return {
      id: a.publicId,
      titleEn: a.titleEn,
      titleBn: a.titleBn,
      textEn: a.textEn,
      textBn: a.textBn,
      image: this.ref(a.media)!,
      linkHref: a.linkHref,
      placement: a.placement,
    };
  }

  // ── Console: offers ───────────────────────────────────────────────────────

  async adminOffers(now: Date = new Date()) {
    const rows = await this.db.offer.findMany({
      orderBy: [{ status: "asc" }, { sortOrder: "asc" }, { id: "desc" }],
      include: OFFER_INCLUDE,
    });
    return { items: rows.map((o) => this.offerView(o, now)) };
  }

  private async mediaId(tx: Tx, key: string | null): Promise<bigint | null> {
    if (!key) return null;
    const m = await tx.mediaAsset.findUnique({ where: { storageKey: key }, select: { id: true } });
    if (!m)
      throw new ProblemException(
        422,
        "unknown-media",
        "Unknown image",
        "Pick an image from the media library.",
      );
    return m.id;
  }

  private offerData(input: OfferInput) {
    return {
      titleEn: input.titleEn,
      titleBn: input.titleBn,
      summaryEn: input.summaryEn,
      summaryBn: input.summaryBn,
      detailsEn: input.detailsEn,
      detailsBn: input.detailsBn,
      priceMinor: BigInt(input.priceMinor),
      originalPriceMinor:
        input.originalPriceMinor === null ? null : BigInt(input.originalPriceMinor),
      validUntil: input.validUntil ? new Date(input.validUntil) : null,
      stock: input.stock,
      status: input.status,
      sortOrder: input.sortOrder,
    };
  }

  async createOffer(input: OfferInput & { slug: string }, actor: AuthContext, ip: string | null) {
    try {
      const o = await this.db.$transaction(async (tx) => {
        const created = await tx.offer.create({
          data: {
            ...this.offerData(input),
            publicId: newPublicId(),
            slug: input.slug,
            heroMediaId: await this.mediaId(tx, input.heroMedia),
          },
          include: OFFER_INCLUDE,
        });
        await this.record(tx, actor, ip, "offer.created", "offer", created.publicId, {
          slug: input.slug,
        });
        return created;
      });
      return { offer: this.offerView(o, new Date()) };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ProblemException(409, "slug-taken", "That web address is already used");
      }
      throw error;
    }
  }

  async updateOffer(publicId: string, input: OfferInput, actor: AuthContext, ip: string | null) {
    const o = await this.db.$transaction(async (tx) => {
      const found = await tx.offer.findUnique({ where: { publicId } });
      if (!found) throw new ProblemException(404, "offer-not-found", "Offer not found");
      if (input.stock !== null && input.stock < found.sold) {
        throw new ProblemException(
          422,
          "stock-below-sold",
          `${found.sold} already sold; stock cannot be lower`,
        );
      }
      const updated = await tx.offer.update({
        where: { id: found.id },
        data: { ...this.offerData(input), heroMediaId: await this.mediaId(tx, input.heroMedia) },
        include: OFFER_INCLUDE,
      });
      await this.record(tx, actor, ip, "offer.updated", "offer", publicId, {
        status: input.status,
      });
      return updated;
    });
    return { offer: this.offerView(o, new Date()) };
  }

  // ── Console: ads ──────────────────────────────────────────────────────────

  private adView(a: AdRow, now: Date): z.infer<typeof AdminAdSchema> {
    return {
      ...this.publicAd(a),
      startsAt: a.startsAt?.toISOString() ?? null,
      endsAt: a.endsAt?.toISOString() ?? null,
      active: a.active,
      sortOrder: a.sortOrder,
      live: a.active && (!a.startsAt || a.startsAt <= now) && (!a.endsAt || a.endsAt > now),
    };
  }

  async adminAds(now: Date = new Date()) {
    const rows = await this.db.ad.findMany({
      orderBy: [{ placement: "asc" }, { sortOrder: "asc" }, { id: "desc" }],
      include: AD_INCLUDE,
    });
    return { items: rows.map((a) => this.adView(a, now)) };
  }

  private adData(input: AdInput) {
    return {
      titleEn: input.titleEn,
      titleBn: input.titleBn,
      textEn: input.textEn,
      textBn: input.textBn,
      linkHref: input.linkHref,
      placement: input.placement,
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
      active: input.active,
      sortOrder: input.sortOrder,
    };
  }

  async createAd(input: AdInput, actor: AuthContext, ip: string | null) {
    const a = await this.db.$transaction(async (tx) => {
      const created = await tx.ad.create({
        data: {
          ...this.adData(input),
          publicId: newPublicId(),
          mediaId: (await this.mediaId(tx, input.media))!,
        },
        include: AD_INCLUDE,
      });
      await this.record(tx, actor, ip, "ad.created", "ad", created.publicId, {
        placement: input.placement,
      });
      return created;
    });
    return { ad: this.adView(a, new Date()) };
  }

  async updateAd(publicId: string, input: AdInput, actor: AuthContext, ip: string | null) {
    const a = await this.db.$transaction(async (tx) => {
      const found = await tx.ad.findUnique({ where: { publicId } });
      if (!found) throw new ProblemException(404, "ad-not-found", "Ad not found");
      const updated = await tx.ad.update({
        where: { id: found.id },
        data: { ...this.adData(input), mediaId: (await this.mediaId(tx, input.media))! },
        include: AD_INCLUDE,
      });
      await this.record(tx, actor, ip, "ad.updated", "ad", publicId, { active: input.active });
      return updated;
    });
    return { ad: this.adView(a, new Date()) };
  }

  async deleteAd(publicId: string, actor: AuthContext, ip: string | null) {
    await this.db.$transaction(async (tx) => {
      const found = await tx.ad.findUnique({ where: { publicId } });
      if (!found) throw new ProblemException(404, "ad-not-found", "Ad not found");
      await tx.ad.delete({ where: { id: found.id } });
      await this.record(tx, actor, ip, "ad.deleted", "ad", publicId, {});
    });
  }

  private record(
    tx: Tx,
    actor: AuthContext,
    ip: string | null,
    action: string,
    targetType: string,
    targetId: string,
    metadata: Record<string, unknown>,
  ) {
    return this.audit.record(
      {
        actorType: "STAFF",
        actorUserId: actor.user.id,
        action,
        targetType,
        targetId,
        ipAddress: ip,
        metadata: metadata as Prisma.InputJsonValue,
      },
      tx,
    );
  }
}
