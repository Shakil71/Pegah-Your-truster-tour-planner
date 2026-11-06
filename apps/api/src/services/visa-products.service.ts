import { Inject, Injectable } from "@nestjs/common";
import type { z } from "zod";
import type { CreateVisaProductSchema, VisaProductInputSchema } from "@pegah/contracts";
import { Prisma } from "@pegah/db";
import { AuditService } from "../audit/audit.service";
import type { AuthContext } from "../auth/auth.types";
import { toMedia } from "../catalog/catalog.mappers";
import { newPublicId } from "../common/ids";
import { toMoney } from "../common/money";
import { ProblemException } from "../common/problem";
import { APP_CONFIG, type AppConfig } from "../config/config";
import { PRISMA, type Db } from "../prisma/prisma.service";

type Input = z.infer<typeof VisaProductInputSchema>;
type Create = z.infer<typeof CreateVisaProductSchema>;

const MEDIA = {
  select: { storageKey: true, altText: true, credit: true, width: true, height: true },
} as const;
const strings = (v: unknown) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

/** Visas Pegah handles (ADR-0039): public list and console management. */
@Injectable()
export class VisaProductsService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private summary(v: Prisma.VisaProductGetPayload<{ include: { hero: typeof MEDIA } }>) {
    return {
      slug: v.slug,
      country: v.country,
      countryBn: v.countryBn,
      visaType: v.visaType,
      summary: v.summary,
      processingTime: v.processingTime,
      validity: v.validity,
      fee: toMoney(v.feeMinor, v.currency),
      hero: toMedia(v.hero, this.config.MEDIA_BASE_URL),
    };
  }

  async list() {
    const rows = await this.db.visaProduct.findMany({
      where: { status: "PUBLISHED" },
      orderBy: [{ sortOrder: "asc" }, { country: "asc" }],
      include: { hero: MEDIA },
    });
    return { items: rows.map((v) => this.summary(v)) };
  }

  async detail(slug: string) {
    const v = await this.db.visaProduct.findFirst({
      where: { slug, status: "PUBLISHED" },
      include: { hero: MEDIA },
    });
    if (!v) throw new ProblemException(404, "visa-not-found", "Visa not found");
    return { ...this.summary(v), requirements: strings(v.requirements), notes: v.notes };
  }

  // ─── Console ──────────────────────────────────────────────────────────────

  async adminList() {
    const rows = await this.db.visaProduct.findMany({
      orderBy: [{ sortOrder: "asc" }, { country: "asc" }],
      include: { hero: { select: { storageKey: true, altText: true } } },
    });
    const open = await this.db.serviceRequest.groupBy({
      by: ["visaProductId"],
      where: {
        visaProductId: { in: rows.map((r) => r.id) },
        status: { notIn: ["COMPLETED", "REJECTED", "CANCELLED"] },
      },
      _count: { _all: true },
    });
    const counts = new Map(open.map((o) => [o.visaProductId, o._count._all]));
    const base = this.config.MEDIA_BASE_URL.replace(/\/$/, "");
    return {
      items: rows.map((v) => ({
        id: v.publicId,
        slug: v.slug,
        country: v.country,
        countryBn: v.countryBn,
        visaType: v.visaType,
        summary: v.summary,
        processingTime: v.processingTime,
        validity: v.validity,
        fee: toMoney(v.feeMinor, v.currency),
        requirements: strings(v.requirements),
        notes: v.notes,
        status: v.status,
        sortOrder: v.sortOrder,
        hero: v.hero
          ? { key: v.hero.storageKey, url: `${base}/${v.hero.storageKey}`, alt: v.hero.altText }
          : null,
        openRequests: counts.get(v.id) ?? 0,
      })),
    };
  }

  private async fields(tx: Prisma.TransactionClient, input: Input) {
    if (input.fee.currency !== "BDT") {
      throw new ProblemException(422, "currency", "Prices are in taka (BDT)");
    }
    let heroMediaId: bigint | null | undefined;
    if (input.heroMedia === null) heroMediaId = null;
    else if (input.heroMedia) {
      const m = await tx.mediaAsset.findUnique({
        where: { storageKey: input.heroMedia },
        select: { id: true },
      });
      if (!m) throw new ProblemException(422, "unknown-media", "Unknown image");
      heroMediaId = m.id;
    }
    return {
      country: input.country,
      countryBn: input.countryBn ?? null,
      visaType: input.visaType,
      summary: input.summary,
      processingTime: input.processingTime,
      validity: input.validity ?? null,
      feeMinor: BigInt(input.fee.amountMinor),
      currency: "BDT",
      requirements: input.requirements,
      notes: input.notes ?? null,
      status: input.status,
      sortOrder: input.sortOrder,
      ...(heroMediaId !== undefined ? { heroMediaId } : {}),
    };
  }

  async create(input: Create, actor: AuthContext, ip: string | null) {
    try {
      await this.db.$transaction(async (tx) => {
        await tx.visaProduct.create({
          data: { publicId: newPublicId(), slug: input.slug, ...(await this.fields(tx, input)) },
        });
        await this.log(tx, actor, ip, "visa_product.created", input.slug, { status: input.status });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ProblemException(409, "slug-taken", "That URL slug is already used");
      }
      throw error;
    }
    return this.adminList();
  }

  async update(slug: string, input: Input, actor: AuthContext, ip: string | null) {
    await this.db.$transaction(async (tx) => {
      const found = await tx.visaProduct.findUnique({ where: { slug }, select: { id: true } });
      if (!found) throw new ProblemException(404, "visa-not-found", "Visa not found");
      await tx.visaProduct.update({ where: { id: found.id }, data: await this.fields(tx, input) });
      await this.log(tx, actor, ip, "visa_product.updated", slug, { status: input.status });
    });
    return this.adminList();
  }

  private log(
    tx: Prisma.TransactionClient,
    actor: AuthContext,
    ip: string | null,
    action: string,
    slug: string,
    metadata: Prisma.InputJsonObject,
  ) {
    return this.audit.record(
      {
        actorType: "STAFF",
        actorUserId: actor.user.id,
        action,
        targetType: "visa_product",
        targetId: slug,
        ipAddress: ip,
        metadata,
      },
      tx,
    );
  }
}
