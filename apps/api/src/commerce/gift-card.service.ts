import { Inject, Injectable } from "@nestjs/common";
import type { z } from "zod";
import type { AdminGiftCardSchema, AdminGiftCardListQuerySchema } from "@pegah/contracts";
import type { Prisma } from "@pegah/db";
import { createHash, randomInt } from "node:crypto";
import { AuditService } from "../audit/audit.service";
import type { AuthContext } from "../auth/auth.types";
import type { Tx } from "../booking/inventory";
import { decodeCursor, encodeCursor } from "../booking/booking.mappers";
import { newPublicId } from "../common/ids";
import { toMoney } from "../common/money";
import { ProblemException } from "../common/problem";
import { APP_CONFIG, type AppConfig } from "../config/config";
import { PRISMA, type Db } from "../prisma/prisma.service";
import { SecretBox } from "../settings/secret-box";

/** No I, O, 0 or 1: nothing to misread on a printed card. 32 symbols × 16 = 80 random bits. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const VALID_YEARS = 2;

export function newGiftCardCode(): string {
  let code = "";
  for (let i = 0; i < 16; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}
export const formatCode = (code: string) => code.match(/.{4}/g)!.join("-");
export const hashCode = (code: string) => createHash("sha256").update(code).digest("hex");

type AdminView = z.infer<typeof AdminGiftCardSchema>;
const INCLUDE = {
  order: { select: { reference: true } },
  txns: { orderBy: { id: "desc" } },
} satisfies Prisma.GiftCardInclude;
type Row = Prisma.GiftCardGetPayload<{ include: typeof INCLUDE }>;

/**
 * Gift cards (ADR-0032). The code is shown to nobody but the recipient: the
 * database keeps its SHA-256 hash for lookups and a copy sealed with
 * SETTINGS_ENCRYPTION_KEY so staff can resend it. Every balance change is a
 * ledger row in gift_card_txns, and a CHECK keeps the balance within bounds.
 */
@Injectable()
export class GiftCardService {
  private readonly box: SecretBox | null;

  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(APP_CONFIG) config: AppConfig,
  ) {
    this.box = config.SETTINGS_ENCRYPTION_KEY
      ? new SecretBox(config.SETTINGS_ENCRYPTION_KEY)
      : null;
  }

  /** Gift cards are sold only when codes can be sealed for safe resending. */
  get available(): boolean {
    return this.box !== null;
  }

  assertAvailable(): void {
    if (!this.box) {
      throw new ProblemException(
        503,
        "gift-cards-unavailable",
        "Gift cards are not available yet",
        "Please try again later or contact us.",
      );
    }
  }

  /** Creates a card inside the caller's transaction; returns the plain code once. */
  async issueInTx(
    tx: Tx,
    input: {
      amountMinor: bigint;
      currency: string;
      recipientName: string;
      recipientEmail: string;
      orderId?: bigint | null;
      issuedBy?: bigint | null;
      note: string;
    },
    now: Date = new Date(),
  ): Promise<{ id: bigint; publicId: string; code: string }> {
    this.assertAvailable();
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = newGiftCardCode();
      const codeHash = hashCode(code);
      if (await tx.giftCard.findUnique({ where: { codeHash }, select: { id: true } })) continue;
      const publicId = newPublicId();
      const expiresAt = new Date(now);
      expiresAt.setUTCFullYear(expiresAt.getUTCFullYear() + VALID_YEARS);
      const card = await tx.giftCard.create({
        data: {
          publicId,
          codeHash,
          codeSealed: this.box!.seal(code, `giftcard:${publicId}`),
          last4: code.slice(-4),
          initialMinor: input.amountMinor,
          balanceMinor: input.amountMinor,
          currency: input.currency,
          expiresAt,
          recipientName: input.recipientName,
          recipientEmail: input.recipientEmail,
          orderId: input.orderId ?? null,
          issuedBy: input.issuedBy ?? null,
          txns: {
            create: {
              kind: "ISSUE",
              amountMinor: input.amountMinor,
              balanceAfter: input.amountMinor,
              note: input.note.slice(0, 200),
            },
          },
        },
        select: { id: true },
      });
      return { id: card.id, publicId, code };
    }
    throw new Error("Could not generate a unique gift card code");
  }

  /** The plain code for the delivery email, or null if it cannot be unsealed. */
  async revealCode(giftCardId: bigint): Promise<string | null> {
    const card = await this.db.giftCard.findUnique({
      where: { id: giftCardId },
      select: { publicId: true, codeSealed: true },
    });
    if (!card?.codeSealed || !this.box) return null;
    return this.box.open(card.codeSealed, `giftcard:${card.publicId}`);
  }

  /** Public balance check. Unknown codes and void cards look the same (no enumeration hints). */
  async balance(code: string, now: Date = new Date()) {
    const card = await this.db.giftCard.findUnique({ where: { codeHash: hashCode(code) } });
    if (!card || card.status !== "ACTIVE") {
      throw new ProblemException(404, "gift-card-not-found", "We could not find that gift card");
    }
    return {
      last4: card.last4,
      balance: toMoney(card.balanceMinor, card.currency),
      expiresAt: card.expiresAt.toISOString(),
      usable: card.balanceMinor > 0n && card.expiresAt > now,
    };
  }

  // ── Console ───────────────────────────────────────────────────────────────

  private view(c: Row, refs: Map<bigint, string>): AdminView {
    return {
      id: c.publicId,
      last4: c.last4,
      initial: toMoney(c.initialMinor, c.currency),
      balance: toMoney(c.balanceMinor, c.currency),
      status: c.status,
      expiresAt: c.expiresAt.toISOString(),
      recipientName: c.recipientName,
      recipientEmail: c.recipientEmail,
      orderReference: c.order?.reference ?? null,
      createdAt: c.createdAt.toISOString(),
      txns: c.txns.map((t) => ({
        kind: t.kind,
        // Absolute amount; the kind says whether it added (ISSUE, RELEASE) or took (REDEEM, VOID).
        amount: toMoney(t.amountMinor < 0n ? -t.amountMinor : t.amountMinor, c.currency),
        balanceAfter: toMoney(t.balanceAfter, c.currency),
        bookingReference: t.bookingId !== null ? (refs.get(t.bookingId) ?? null) : null,
        note: t.note,
        at: t.createdAt.toISOString(),
      })),
    };
  }

  /** Booking references for the ledger rows that redeemed or returned money. */
  private async bookingRefs(cards: Row[]): Promise<Map<bigint, string>> {
    const ids = [...new Set(cards.flatMap((c) => c.txns.map((t) => t.bookingId)))].filter(
      (id): id is bigint => id !== null,
    );
    if (ids.length === 0) return new Map();
    const rows = await this.db.booking.findMany({
      where: { id: { in: ids } },
      select: { id: true, reference: true },
    });
    return new Map(rows.map((b) => [b.id, b.reference]));
  }

  async list(q: z.infer<typeof AdminGiftCardListQuerySchema>) {
    const where: Prisma.GiftCardWhereInput = {};
    if (q.q) {
      const term = q.q.toUpperCase().replace(/[^A-Z0-9@.\-_]/g, "");
      where.OR = [
        { last4: term.slice(-4) },
        { recipientEmail: { startsWith: q.q.toLowerCase() } },
        { order: { reference: term } },
      ];
    }
    const before = decodeCursor(q.cursor);
    if (before !== undefined) where.id = { lt: before };
    const rows = await this.db.giftCard.findMany({
      where,
      orderBy: { id: "desc" },
      take: q.limit + 1,
      include: INCLUDE,
    });
    const page = rows.slice(0, q.limit);
    const refs = await this.bookingRefs(page);
    return {
      items: page.map((c) => this.view(c, refs)),
      nextCursor:
        rows.length > q.limit && page.length > 0 ? encodeCursor(page[page.length - 1]!.id) : null,
    };
  }

  async detail(publicId: string): Promise<AdminView> {
    const c = await this.db.giftCard.findUnique({ where: { publicId }, include: INCLUDE });
    if (!c) throw new ProblemException(404, "gift-card-not-found", "Gift card not found");
    return this.view(c, await this.bookingRefs([c]));
  }

  /** Staff-issued card (compensation, promotion); delivered by email through the outbox. */
  async issueManually(
    input: {
      amountTaka: number;
      recipientName: string;
      recipientEmail: string;
      message?: string;
      reason: string;
    },
    actor: AuthContext,
    ip: string | null,
  ): Promise<AdminView> {
    this.assertAvailable();
    const card = await this.db.$transaction(async (tx) => {
      const issued = await this.issueInTx(tx, {
        amountMinor: BigInt(input.amountTaka) * 100n,
        currency: "BDT",
        recipientName: input.recipientName,
        recipientEmail: input.recipientEmail,
        issuedBy: actor.user.id,
        note: `Issued by staff: ${input.reason}`,
      });
      await tx.outboxEvent.create({
        data: {
          eventType: "giftcard.deliver",
          aggregateType: "gift_card",
          aggregateId: issued.publicId,
          payload: { message: input.message ?? null, from: "Pegah" },
        },
      });
      await this.audit.record(
        {
          actorType: "STAFF",
          actorUserId: actor.user.id,
          action: "giftcard.issued",
          targetType: "gift_card",
          targetId: issued.publicId,
          ipAddress: ip,
          metadata: { amountTaka: input.amountTaka, reason: input.reason },
        },
        tx,
      );
      return issued;
    });
    return this.detail(card.publicId);
  }

  /** Cancels a card: its remaining balance can no longer be used. */
  async void(
    publicId: string,
    reason: string,
    actor: AuthContext,
    ip: string | null,
  ): Promise<AdminView> {
    await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM gift_cards WHERE public_id = ${publicId} FOR UPDATE`;
      const card = await tx.giftCard.findUnique({ where: { publicId } });
      if (!card) throw new ProblemException(404, "gift-card-not-found", "Gift card not found");
      if (card.status === "VOID")
        throw new ProblemException(409, "gift-card-void", "This gift card is already void");
      await tx.giftCard.update({
        where: { id: card.id },
        data: { status: "VOID", balanceMinor: 0n },
      });
      await tx.giftCardTxn.create({
        data: {
          giftCardId: card.id,
          kind: "VOID",
          amountMinor: -card.balanceMinor,
          balanceAfter: 0n,
          note: reason.slice(0, 200),
        },
      });
      await this.audit.record(
        {
          actorType: "STAFF",
          actorUserId: actor.user.id,
          action: "giftcard.voided",
          targetType: "gift_card",
          targetId: publicId,
          ipAddress: ip,
          metadata: { reason, balanceMinor: card.balanceMinor.toString() },
        },
        tx,
      );
    });
    return this.detail(publicId);
  }

  /** Queues the delivery email again (lost email, wrong inbox). */
  async resend(publicId: string, actor: AuthContext, ip: string | null): Promise<void> {
    const card = await this.db.giftCard.findUnique({ where: { publicId } });
    if (!card) throw new ProblemException(404, "gift-card-not-found", "Gift card not found");
    if (card.status !== "ACTIVE")
      throw new ProblemException(409, "gift-card-void", "This gift card is void");
    await this.db.$transaction(async (tx) => {
      await tx.outboxEvent.create({
        data: {
          eventType: "giftcard.deliver",
          aggregateType: "gift_card",
          aggregateId: publicId,
          payload: { message: null, from: "Pegah", resend: true },
        },
      });
      await this.audit.record(
        {
          actorType: "STAFF",
          actorUserId: actor.user.id,
          action: "giftcard.resent",
          targetType: "gift_card",
          targetId: publicId,
          ipAddress: ip,
        },
        tx,
      );
    });
  }
}
