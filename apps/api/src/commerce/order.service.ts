import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import type { z } from "zod";
import type {
  AdminOrderListQuerySchema,
  AdminOrderSchema,
  CreateGiftCardOrderSchema,
  CreateOfferOrderSchema,
  OrderViewSchema,
} from "@pegah/contracts";
import { Prisma } from "@pegah/db";
import { AuditService } from "../audit/audit.service";
import type { AuthContext } from "../auth/auth.types";
import { decodeCursor, encodeCursor } from "../booking/booking.mappers";
import { newOrderReference, newPublicId } from "../common/ids";
import { toMoney } from "../common/money";
import { ProblemException } from "../common/problem";
import { APP_CONFIG, type AppConfig } from "../config/config";
import { PaymentService } from "../payments/payment.service";
import { PRISMA, type Db } from "../prisma/prisma.service";
import { IntegrationSettings } from "../settings/integration-settings.service";
import { GiftCardService } from "./gift-card.service";
import { OrderFulfilment } from "./order-fulfilment.service";

/** Unpaid orders are kept this long (offline payment needs time), then expire. */
const ORDER_TTL_MS = 48 * 60 * 60_000;
const SWEEP_MS = 5 * 60_000;

const INCLUDE = {
  offer: { select: { titleEn: true, titleBn: true } },
  giftCard: {
    select: { last4: true, balanceMinor: true, expiresAt: true, status: true, currency: true },
  },
  user: { select: { publicId: true, fullName: true, email: true } },
} satisfies Prisma.OrderInclude;
type Row = Prisma.OrderGetPayload<{ include: typeof INCLUDE }>;
type View = z.infer<typeof OrderViewSchema>;

/**
 * Orders for offers and gift cards (ADR-0032). Prices come from the server;
 * offer stock is reserved under a row lock when the order is placed and given
 * back if it expires or is cancelled. Staff are alerted by email on every new
 * order and every payment.
 */
@Injectable()
export class OrderService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger("Orders");
  private timer: NodeJS.Timeout | undefined;

  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(IntegrationSettings) private readonly integrations: IntegrationSettings,
    @Inject(GiftCardService) private readonly giftCards: GiftCardService,
    @Inject(OrderFulfilment) private readonly fulfilment: OrderFulfilment,
    @Inject(PaymentService) private readonly payments: PaymentService,
  ) {}

  onModuleInit(): void {
    if (!this.config.RUN_BACKGROUND_JOBS || this.config.HOLD_SWEEP_SECONDS === 0) return;
    this.timer = setInterval(() => {
      this.expireDue().catch((error: unknown) =>
        this.logger.warn({ err: error }, "Order sweep failed"),
      );
    }, SWEEP_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  view(o: Row, now: Date = new Date()): View {
    const isGift = o.kind === "GIFT_CARD";
    const amountTaka = Number(o.amountMinor / 100n).toLocaleString("en-IN");
    return {
      id: o.publicId,
      reference: o.reference,
      kind: o.kind,
      status: o.status,
      title: isGift ? `Pegah gift card · ৳${amountTaka}` : (o.offer?.titleEn ?? "Offer"),
      titleBn: isGift ? `পেগাহ গিফট কার্ড · ৳${amountTaka}` : (o.offer?.titleBn ?? "অফার"),
      quantity: o.quantity,
      total: toMoney(o.amountMinor, o.currency),
      buyer: { name: o.buyerName, email: o.buyerEmail, phone: o.buyerPhone },
      recipient: isGift
        ? { name: o.recipientName ?? o.buyerName, email: o.recipientEmail ?? o.buyerEmail }
        : null,
      giftMessage: o.giftMessage,
      note: o.note,
      expiresAt: o.expiresAt.toISOString(),
      paidAt: o.paidAt?.toISOString() ?? null,
      paidOffline: o.paidOffline,
      canPay:
        this.integrations.paymentProvider() !== null &&
        o.status === "PENDING_PAYMENT" &&
        o.expiresAt.getTime() - now.getTime() > 60_000,
      giftCard: o.giftCard
        ? {
            last4: o.giftCard.last4,
            balance: toMoney(o.giftCard.balanceMinor, o.giftCard.currency),
            expiresAt: o.giftCard.expiresAt.toISOString(),
            status: o.giftCard.status,
          }
        : null,
      createdAt: o.createdAt.toISOString(),
    };
  }

  private adminView(o: Row): z.infer<typeof AdminOrderSchema> {
    return {
      ...this.view(o),
      customer: { id: o.user.publicId, fullName: o.user.fullName, email: o.user.email },
    };
  }

  // ── Placing orders ────────────────────────────────────────────────────────

  async createOfferOrder(
    input: z.infer<typeof CreateOfferOrderSchema>,
    auth: AuthContext,
    now = new Date(),
  ) {
    const publicId = await this.db.$transaction(async (tx) => {
      const found = await tx.offer.findUnique({
        where: { publicId: input.offerId },
        select: { id: true },
      });
      if (!found) throw new ProblemException(404, "offer-not-found", "Offer not found");
      await tx.$queryRaw`SELECT id FROM offers WHERE id = ${found.id} FOR UPDATE`;
      const offer = await tx.offer.findUniqueOrThrow({ where: { id: found.id } });
      if (offer.status !== "PUBLISHED" || (offer.validUntil && offer.validUntil <= now)) {
        throw new ProblemException(409, "offer-unavailable", "This offer is no longer available");
      }
      if (offer.stock !== null && offer.sold + input.quantity > offer.stock) {
        throw new ProblemException(
          409,
          "offer-sold-out",
          "Not enough left",
          `Only ${Math.max(0, offer.stock - offer.sold)} left.`,
        );
      }
      const amountMinor = offer.priceMinor * BigInt(input.quantity);
      if (
        BigInt(input.expectedTotal.amountMinor) !== amountMinor ||
        input.expectedTotal.currency !== offer.currency
      ) {
        throw new ProblemException(
          409,
          "price-changed",
          "The price has changed. Please review the new total.",
        );
      }
      await tx.offer.update({
        where: { id: offer.id },
        data: { sold: { increment: input.quantity } },
      });
      return this.insertOrder(tx, {
        kind: "OFFER",
        userId: auth.user.id,
        offerId: offer.id,
        quantity: input.quantity,
        amountMinor,
        currency: offer.currency,
        buyer: input.buyer,
        note: input.note ?? null,
        now,
      });
    });
    return this.mine(publicId, auth);
  }

  async createGiftCardOrder(
    input: z.infer<typeof CreateGiftCardOrderSchema>,
    auth: AuthContext,
    now = new Date(),
  ) {
    this.giftCards.assertAvailable();
    const publicId = await this.db.$transaction((tx) =>
      this.insertOrder(tx, {
        kind: "GIFT_CARD",
        userId: auth.user.id,
        offerId: null,
        quantity: 1,
        amountMinor: BigInt(input.amountTaka) * 100n,
        currency: "BDT",
        buyer: input.buyer,
        note: null,
        recipientName: input.forSelf ? input.buyer.name : input.recipientName!,
        recipientEmail: input.forSelf ? input.buyer.email : input.recipientEmail!,
        giftMessage: input.forSelf ? null : (input.message ?? null),
        now,
      }),
    );
    return this.mine(publicId, auth);
  }

  private async insertOrder(
    tx: Prisma.TransactionClient,
    o: {
      kind: "OFFER" | "GIFT_CARD";
      userId: bigint;
      offerId: bigint | null;
      quantity: number;
      amountMinor: bigint;
      currency: string;
      buyer: { name: string; email: string; phone: string };
      note: string | null;
      recipientName?: string;
      recipientEmail?: string;
      giftMessage?: string | null;
      now: Date;
    },
  ): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const publicId = newPublicId();
      try {
        await tx.order.create({
          data: {
            publicId,
            reference: newOrderReference(),
            kind: o.kind,
            userId: o.userId,
            offerId: o.offerId,
            quantity: o.quantity,
            amountMinor: o.amountMinor,
            currency: o.currency,
            buyerName: o.buyer.name,
            buyerEmail: o.buyer.email,
            buyerPhone: o.buyer.phone,
            note: o.note,
            recipientName: o.recipientName ?? null,
            recipientEmail: o.recipientEmail ?? null,
            giftMessage: o.giftMessage ?? null,
            expiresAt: new Date(o.now.getTime() + ORDER_TTL_MS),
          },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
          continue;
        throw error;
      }
      await tx.outboxEvent.createMany({
        data: [
          {
            eventType: "order.created.buyer",
            aggregateType: "order",
            aggregateId: publicId,
            payload: {},
          },
          {
            eventType: "order.created.staff",
            aggregateType: "order",
            aggregateId: publicId,
            payload: {},
          },
        ],
      });
      await this.audit.record(
        {
          actorType: "CUSTOMER",
          actorUserId: o.userId,
          action: "order.created",
          targetType: "order",
          targetId: publicId,
          metadata: { kind: o.kind, amountMinor: o.amountMinor.toString() },
        },
        tx,
      );
      return publicId;
    }
    throw new Error("Could not allocate an order reference");
  }

  // ── Customer views ────────────────────────────────────────────────────────

  async mine(publicId: string, auth: AuthContext): Promise<View> {
    const o = await this.db.order.findFirst({
      where: { publicId, userId: auth.user.id },
      include: INCLUDE,
    });
    if (!o) throw new ProblemException(404, "order-not-found", "Order not found");
    return this.view(o);
  }

  async listMine(auth: AuthContext, cursor?: string) {
    const before = decodeCursor(cursor);
    const rows = await this.db.order.findMany({
      where: { userId: auth.user.id, ...(before !== undefined ? { id: { lt: before } } : {}) },
      orderBy: { id: "desc" },
      take: 21,
      include: INCLUDE,
    });
    const page = rows.slice(0, 20);
    return {
      items: page.map((o) => this.view(o)),
      nextCursor: rows.length > 20 && page.length ? encodeCursor(page[page.length - 1]!.id) : null,
    };
  }

  // ── Console ───────────────────────────────────────────────────────────────

  async adminList(q: z.infer<typeof AdminOrderListQuerySchema>) {
    const where: Prisma.OrderWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.kind) where.kind = q.kind;
    const before = decodeCursor(q.cursor);
    if (before !== undefined) where.id = { lt: before };
    const rows = await this.db.order.findMany({
      where,
      orderBy: { id: "desc" },
      take: q.limit + 1,
      include: INCLUDE,
    });
    const page = rows.slice(0, q.limit);
    return {
      items: page.map((o) => this.adminView(o)),
      nextCursor:
        rows.length > q.limit && page.length ? encodeCursor(page[page.length - 1]!.id) : null,
    };
  }

  async adminDetail(publicId: string) {
    const o = await this.db.order.findUnique({ where: { publicId }, include: INCLUDE });
    if (!o) throw new ProblemException(404, "order-not-found", "Order not found");
    return this.adminView(o);
  }

  /** Staff record a payment received outside the website (cash, bKash, bank transfer). */
  async markPaid(publicId: string, reference: string, actor: AuthContext, ip: string | null) {
    await this.db.$transaction(async (tx) => {
      const o = await tx.order.findUnique({ where: { publicId }, select: { id: true } });
      if (!o) throw new ProblemException(404, "order-not-found", "Order not found");
      const outcome = await this.fulfilment.markPaidInTx(tx, o.id, { offline: reference });
      if (outcome === "already-paid")
        throw new ProblemException(409, "order-paid", "This order is already paid");
      if (outcome === "not-payable") {
        throw new ProblemException(
          409,
          "order-not-payable",
          "Only unpaid orders can be marked as paid",
        );
      }
      await this.audit.record(
        {
          actorType: "STAFF",
          actorUserId: actor.user.id,
          action: "order.marked_paid",
          targetType: "order",
          targetId: publicId,
          ipAddress: ip,
          metadata: { reference },
        },
        tx,
      );
    });
    return this.adminDetail(publicId);
  }

  async cancel(publicId: string, reason: string, actor: AuthContext, ip: string | null) {
    await this.db.$transaction(async (tx) => {
      const o = await tx.order.findUnique({ where: { publicId }, select: { id: true } });
      if (!o) throw new ProblemException(404, "order-not-found", "Order not found");
      const done = await this.endUnpaid(tx, o.id, "CANCELLED");
      if (!done)
        throw new ProblemException(
          409,
          "order-not-cancellable",
          "Only unpaid orders can be cancelled",
        );
      await this.audit.record(
        {
          actorType: "STAFF",
          actorUserId: actor.user.id,
          action: "order.cancelled",
          targetType: "order",
          targetId: publicId,
          ipAddress: ip,
          metadata: { reason },
        },
        tx,
      );
    });
    return this.adminDetail(publicId);
  }

  /** Ends an unpaid order and gives offer stock back. False if it was not unpaid. */
  private async endUnpaid(
    tx: Prisma.TransactionClient,
    orderId: bigint,
    to: "CANCELLED" | "EXPIRED",
  ) {
    await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`;
    const o = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    if (o.status !== "PENDING_PAYMENT") return false;
    await tx.order.update({ where: { id: o.id }, data: { status: to } });
    if (o.offerId) {
      await tx.$executeRaw`UPDATE offers SET sold = GREATEST(0, CAST(sold AS SIGNED) - ${o.quantity}) WHERE id = ${o.offerId}`;
    }
    return true;
  }

  /** Expires unpaid orders past their time (worker). */
  async expireDue(now: Date = new Date()): Promise<number> {
    const due = await this.db.order.findMany({
      where: { status: "PENDING_PAYMENT", expiresAt: { lte: now } },
      select: { id: true },
      take: 50,
    });
    let n = 0;
    for (const o of due) {
      // A lost callback must not expire an order that was actually paid.
      await this.payments.reconcileOrder(o.id, now);
      const done = await this.db.$transaction((tx) => this.endUnpaid(tx, o.id, "EXPIRED"));
      if (done) n++;
    }
    return n;
  }
}
