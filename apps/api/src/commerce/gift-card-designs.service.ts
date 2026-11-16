import { Inject, Injectable } from "@nestjs/common";
import type { z } from "zod";
import type {
  AdminGiftCardDesignSchema,
  GiftCardDesignInput,
  PublicGiftCardDesignSchema,
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

const INCLUDE = {
  media: { select: { storageKey: true, altText: true, width: true, height: true } },
} satisfies Prisma.GiftCardDesignInclude;
type Row = Prisma.GiftCardDesignGetPayload<{ include: typeof INCLUDE }>;

/**
 * Gift card designs the owner makes in the console: a photo, a name, a
 * suggested amount and a gift message. A design only prefills the purchase
 * form; the amount charged is still validated and recomputed by OrderService.
 */
@Injectable()
export class GiftCardDesignsService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private publicView(d: Row): z.infer<typeof PublicGiftCardDesignSchema> {
    return {
      id: d.publicId,
      nameEn: d.nameEn,
      nameBn: d.nameBn,
      labelEn: d.labelEn,
      labelBn: d.labelBn,
      lineEn: d.lineEn,
      lineBn: d.lineBn,
      messageEn: d.messageEn,
      messageBn: d.messageBn,
      amount: toMoney(d.amountMinor, d.currency),
      image: {
        key: d.media.storageKey,
        url: `${this.config.MEDIA_BASE_URL.replace(/\/$/, "")}/${d.media.storageKey}`,
        alt: d.media.altText,
        width: d.media.width,
        height: d.media.height,
      },
    };
  }

  private adminView(d: Row): z.infer<typeof AdminGiftCardDesignSchema> {
    return {
      ...this.publicView(d),
      active: d.active,
      sortOrder: d.sortOrder,
      updatedAt: d.updatedAt.toISOString(),
    };
  }

  async publicList() {
    const rows = await this.db.giftCardDesign.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      take: 24,
      include: INCLUDE,
    });
    return { items: rows.map((d) => this.publicView(d)) };
  }

  async adminList() {
    const rows = await this.db.giftCardDesign.findMany({
      orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
      include: INCLUDE,
    });
    return { items: rows.map((d) => this.adminView(d)) };
  }

  private async data(tx: Tx, input: GiftCardDesignInput) {
    const media = await tx.mediaAsset.findUnique({
      where: { storageKey: input.media },
      select: { id: true },
    });
    if (!media) {
      throw new ProblemException(
        422,
        "unknown-media",
        "Unknown image",
        "Pick an image from the media library.",
      );
    }
    return {
      nameEn: input.nameEn,
      nameBn: input.nameBn,
      labelEn: input.labelEn,
      labelBn: input.labelBn,
      lineEn: input.lineEn,
      lineBn: input.lineBn,
      messageEn: input.messageEn,
      messageBn: input.messageBn,
      amountMinor: BigInt(input.amountMinor),
      currency: "BDT",
      mediaId: media.id,
      active: input.active,
      sortOrder: input.sortOrder,
    };
  }

  async create(input: GiftCardDesignInput, actor: AuthContext, ip: string | null) {
    const d = await this.db.$transaction(async (tx) => {
      const created = await tx.giftCardDesign.create({
        data: { ...(await this.data(tx, input)), publicId: newPublicId() },
        include: INCLUDE,
      });
      await this.record(tx, actor, ip, "gift-card-design.created", created.publicId, {
        amountMinor: input.amountMinor,
      });
      return created;
    });
    return { design: this.adminView(d) };
  }

  async update(
    publicId: string,
    input: GiftCardDesignInput,
    actor: AuthContext,
    ip: string | null,
  ) {
    const d = await this.db.$transaction(async (tx) => {
      const found = await tx.giftCardDesign.findUnique({ where: { publicId } });
      if (!found) throw new ProblemException(404, "design-not-found", "Design not found");
      const updated = await tx.giftCardDesign.update({
        where: { id: found.id },
        data: await this.data(tx, input),
        include: INCLUDE,
      });
      await this.record(tx, actor, ip, "gift-card-design.updated", publicId, {
        active: input.active,
        amountMinor: input.amountMinor,
      });
      return updated;
    });
    return { design: this.adminView(d) };
  }

  async remove(publicId: string, actor: AuthContext, ip: string | null) {
    await this.db.$transaction(async (tx) => {
      const found = await tx.giftCardDesign.findUnique({ where: { publicId } });
      if (!found) throw new ProblemException(404, "design-not-found", "Design not found");
      await tx.giftCardDesign.delete({ where: { id: found.id } });
      await this.record(tx, actor, ip, "gift-card-design.deleted", publicId, {});
    });
  }

  private record(
    tx: Tx,
    actor: AuthContext,
    ip: string | null,
    action: string,
    targetId: string,
    metadata: Record<string, unknown>,
  ) {
    return this.audit.record(
      {
        actorType: "STAFF",
        actorUserId: actor.user.id,
        action,
        targetType: "gift-card-design",
        targetId,
        ipAddress: ip,
        metadata: metadata as Prisma.InputJsonValue,
      },
      tx,
    );
  }
}
