import { Inject, Injectable, Logger } from "@nestjs/common";
import type { PaymentSessionResponse } from "@pegah/contracts";
import { Prisma } from "@pegah/db";
import { AuditService } from "../audit/audit.service";
import { BookingStatusService } from "../booking/booking-status.service";
import type { Tx } from "../booking/inventory";
import { newPublicId } from "../common/ids";
import { ProblemException } from "../common/problem";
import { APP_CONFIG, type AppConfig } from "../config/config";
import { PRISMA, type Db } from "../prisma/prisma.service";
import { OrderFulfilment } from "../commerce/order-fulfilment.service";
import { IntegrationSettings } from "../settings/integration-settings.service";
import { ProviderError, type PaymentProvider, type Verification } from "./provider";

export type CallbackKind = "ipn" | "success" | "fail" | "cancel";

/** Fields kept from provider callbacks. Card numbers and secrets are never stored. */
const KEEP_FIELDS = [
  "status",
  "tran_id",
  "val_id",
  "amount",
  "currency",
  "currency_type",
  "currency_amount",
  "bank_tran_id",
  "card_brand",
  "card_type",
  "risk_level",
  "risk_title",
  "tran_date",
  "error",
  "value_a",
] as const;

const MIN_HOLD_LEFT_MS = 60_000;

export interface CallbackResult {
  bookingPublicId: string | null;
  /** Set when the payment was for an order (offer or gift card) instead of a booking. */
  orderPublicId?: string | null;
  outcome: "success" | "pending" | "failed" | "cancelled" | "review" | "unknown";
  /** Booked by a partner agent: the payer returns to the partner portal. */
  viaAgent?: boolean;
}

/**
 * Hosted payments (ADR-0022). Rules:
 *  - A browser callback is never trusted: every outcome is verified with the
 *    provider server-to-server, and amount + currency must match the booking.
 *  - No database transaction is held open across a provider call.
 *  - A booking reaches CONFIRMED only here (PAYMENT_PROVIDER actor) or by staff
 *    from MANUAL_REVIEW, always through the booking state machine.
 *  - Callbacks are stored first and de-duplicated by provider event key, so
 *    retries and the IPN/return race are harmless.
 */
@Injectable()
export class PaymentService {
  private readonly logger = new Logger("Payments");

  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(IntegrationSettings) private readonly integrations: IntegrationSettings,
    @Inject(BookingStatusService) private readonly status: BookingStatusService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(OrderFulfilment) private readonly fulfilment: OrderFulfilment,
  ) {}

  /** The current adapter; changes when the owner edits payment settings (ADR-0029). */
  private get provider(): PaymentProvider | null {
    return this.integrations.paymentProvider();
  }

  get enabled(): boolean {
    return this.provider !== null;
  }

  get providerName(): string | null {
    return this.provider?.name ?? null;
  }

  // ── Starting a payment ──────────────────────────────────────────────────────

  async startSession(
    bookingPublicId: string,
    user: { id: bigint },
    ip: string | null,
    now: Date = new Date(),
  ): Promise<PaymentSessionResponse> {
    const provider = this.provider;
    if (!provider) {
      throw new ProblemException(
        503,
        "payments-unavailable",
        "Online payment is not available yet",
        "Online payment opens soon. Your hold stays until the timer ends.",
      );
    }

    // 1. Short transaction: create the attempt and extend the hold once.
    const prepared = await this.db.$transaction(async (tx) => {
      const booking = await tx.booking.findFirst({
        where: { publicId: bookingPublicId, userId: user.id },
        include: { payments: { select: { id: true } } },
      });
      if (!booking) throw new ProblemException(404, "booking-not-found", "Booking not found");
      if (booking.status !== "PENDING_PAYMENT") {
        throw new ProblemException(
          409,
          "booking-not-payable",
          "This booking cannot be paid",
          `The booking is ${booking.status.toLowerCase().replaceAll("_", " ")}.`,
        );
      }
      if (
        !booking.holdExpiresAt ||
        booking.holdExpiresAt.getTime() - now.getTime() < MIN_HOLD_LEFT_MS
      ) {
        throw new ProblemException(
          409,
          "hold-expiring",
          "The hold is about to expire",
          "Less than a minute is left on this hold. Please hold the room or seats again.",
        );
      }
      // First attempt only: give the customer time to finish on the payment page.
      if (booking.payments.length === 0 && this.integrations.paymentExtensionMinutes() > 0) {
        const extended = new Date(
          Math.max(
            booking.holdExpiresAt.getTime(),
            now.getTime() + this.integrations.paymentExtensionMinutes() * 60_000,
          ),
        );
        await tx.booking.update({ where: { id: booking.id }, data: { holdExpiresAt: extended } });
        await tx.inventoryHold.updateMany({
          where: { bookingId: booking.id, status: "ACTIVE" },
          data: { expiresAt: extended },
        });
      }
      const publicId = newPublicId();
      await tx.payment.create({
        data: {
          publicId,
          bookingId: booking.id,
          provider: provider.name,
          providerTxnId: publicId,
          amountMinor: booking.totalMinor,
          currency: booking.currency,
        },
      });
      await this.audit.record(
        {
          actorType: "CUSTOMER",
          actorUserId: user.id,
          action: "payment.session_requested",
          targetType: "booking",
          targetId: booking.publicId,
          ipAddress: ip,
          metadata: { paymentId: publicId, provider: provider.name },
        },
        tx,
      );
      return { booking, paymentPublicId: publicId };
    });

    // 2. Provider call, outside any transaction.
    const base = this.config.PUBLIC_BASE_URL!.replace(/\/$/, "");
    const callback = (path: string) => `${base}/api/v1/payments/${provider.name}/${path}`;
    const b = prepared.booking;
    try {
      const session = await provider.createSession({
        tranId: prepared.paymentPublicId,
        amountMinor: b.totalMinor,
        currency: b.currency,
        booking: { reference: b.reference, productName: b.productName, productType: b.productType },
        customer: { name: b.contactName, email: b.contactEmail, phone: b.contactPhone },
        urls: {
          success: callback("return/success"),
          fail: callback("return/fail"),
          cancel: callback("return/cancel"),
          ipn: callback("ipn"),
        },
      });
      await this.db.payment.update({
        where: { publicId: prepared.paymentPublicId },
        data: { status: "PENDING", providerSession: session.sessionKey },
      });
      return {
        paymentId: prepared.paymentPublicId,
        provider: provider.name,
        mode: provider.mode,
        redirectUrl: session.redirectUrl,
      };
    } catch (error) {
      const reason = error instanceof ProviderError ? error.message : "Provider call failed";
      this.logger.warn({ paymentId: prepared.paymentPublicId, reason }, "Payment session failed");
      await this.db.payment.update({
        where: { publicId: prepared.paymentPublicId },
        data: { status: "FAILED", failureReason: reason.slice(0, 255) },
      });
      throw new ProblemException(
        502,
        "payment-provider-error",
        "Could not open the payment page",
        "The payment service did not respond. Please try again in a moment.",
      );
    }
  }

  // ── Callbacks ──────────────────────────────────────────────────────────────

  /** Handles an IPN or browser return. Safe to call any number of times. */
  async handleCallback(
    kind: CallbackKind,
    raw: Record<string, unknown>,
    now: Date = new Date(),
  ): Promise<CallbackResult> {
    const provider = this.provider;
    if (!provider) return { bookingPublicId: null, outcome: "unknown" };
    const fields = sanitize(raw);
    // Signatures cover fields we never store (e.g. masked card numbers), so check the raw body.
    const signatureOk = provider.verifySignature(stringFields(raw));
    const tranId = fields.tran_id ?? "";
    const payment = /^[0-9A-HJKMNP-TV-Z]{26}$/.test(tranId)
      ? await this.db.payment.findUnique({
          where: { provider_providerTxnId: { provider: provider.name, providerTxnId: tranId } },
          include: {
            booking: { select: { publicId: true, agentPartnerId: true } },
            order: { select: { publicId: true } },
          },
        })
      : null;

    const eventKey =
      `${kind}:${tranId || "-"}:${fields.val_id ?? "-"}:${fields.status ?? "-"}`.slice(0, 160);
    let eventId: bigint | null = null;
    try {
      const event = await this.db.paymentEvent.create({
        data: {
          paymentId: payment?.id ?? null,
          provider: provider.name,
          eventKey,
          kind,
          payload: fields,
          signatureOk,
        },
        select: { id: true },
      });
      eventId = event.id;
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"))
        throw error;
      // Duplicate delivery: already recorded. Report the current state.
    }

    if (!payment) {
      if (eventId) await this.finishEvent(eventId, "unknown-transaction", now);
      return { bookingPublicId: null, outcome: "unknown" };
    }

    let verification: Verification;
    try {
      verification =
        (kind === "success" || kind === "ipn") && fields.val_id
          ? await provider.validate(fields.val_id)
          : await provider.queryByTranId(tranId);
    } catch (error) {
      // Provider unreachable: leave everything as is; the IPN retry or the
      // hold sweeper will reconcile later.
      this.logger.warn({ paymentId: payment.publicId, err: error }, "Verification failed");
      if (eventId) await this.finishEvent(eventId, "verification-unavailable", now);
      return {
        bookingPublicId: payment.booking?.publicId ?? null,
        orderPublicId: payment.order?.publicId ?? null,
        outcome: "pending",
        viaAgent: (payment.booking?.agentPartnerId ?? null) !== null,
      };
    }

    const outcome = await this.applyVerification(payment.id, verification, now);
    if (eventId) await this.finishEvent(eventId, outcome, now);
    return {
      bookingPublicId: payment.booking?.publicId ?? null,
      orderPublicId: payment.order?.publicId ?? null,
      outcome,
      viaAgent: (payment.booking?.agentPartnerId ?? null) !== null,
    };
  }

  /**
   * Asks the provider about every unfinished attempt of a booking (used by the
   * hold sweeper before it expires a booking, in case callbacks were lost).
   */
  async reconcileBooking(bookingId: bigint, now: Date = new Date()): Promise<void> {
    return this.reconcile({ bookingId }, now);
  }

  /** Same check for an order before it expires. */
  async reconcileOrder(orderId: bigint, now: Date = new Date()): Promise<void> {
    return this.reconcile({ orderId }, now);
  }

  private async reconcile(
    target: { bookingId: bigint } | { orderId: bigint },
    now: Date,
  ): Promise<void> {
    if (!this.provider) return;
    const open = await this.db.payment.findMany({
      where: { ...target, status: { in: ["INITIATED", "PENDING"] } },
      select: { id: true, providerTxnId: true },
    });
    for (const p of open) {
      try {
        const v = await this.provider.queryByTranId(p.providerTxnId);
        await this.applyVerification(p.id, v, now);
      } catch (error) {
        this.logger.warn({ err: error }, "Reconciliation lookup failed");
      }
    }
  }

  /** A verified payment for an order: exact amount, then the shared fulfilment path. */
  private async applyOrderPayment(
    tx: Tx,
    payment: {
      id: bigint;
      publicId: string;
      status: string;
      amountMinor: bigint;
      currency: string;
    },
    order: { id: bigint; publicId: string; status: string; amountMinor: bigint; currency: string },
    v: Verification,
    now: Date,
  ): Promise<CallbackResult["outcome"]> {
    if (payment.status === "SUCCEEDED" || payment.status === "REFUND_REQUIRED") {
      return order.status === "PAID" ? "success" : "review";
    }
    const exact =
      v.amountMinor === payment.amountMinor &&
      v.amountMinor === order.amountMinor &&
      v.currency === payment.currency &&
      v.currency === order.currency;
    const paidFields = {
      providerValId: v.valId,
      bankTxnId: v.bankTxnId?.slice(0, 80) ?? null,
      riskLevel: v.riskLevel,
      method: v.method?.slice(0, 60) ?? null,
      succeededAt: now,
    };
    if (!exact || (v.riskLevel ?? 0) !== 0 || order.status !== "PENDING_PAYMENT") {
      // Money arrived but the order cannot simply be fulfilled: staff decide (refund or mark paid).
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          ...paidFields,
          status: order.status === "PENDING_PAYMENT" && exact ? "SUCCEEDED" : "REFUND_REQUIRED",
          failureReason: !exact
            ? "Paid amount or currency does not match the order"
            : order.status !== "PENDING_PAYMENT"
              ? `Paid after the order became ${order.status}`
              : "Flagged by the payment provider",
        },
      });
      await tx.outboxEvent.create({
        data: {
          eventType: "order.payment_review.staff",
          aggregateType: "order",
          aggregateId: order.publicId,
          payload: { paymentId: payment.publicId },
        },
      });
      return "review";
    }
    await tx.payment.update({
      where: { id: payment.id },
      data: { ...paidFields, status: "SUCCEEDED" },
    });
    const outcome = await this.fulfilment.markPaidInTx(tx, order.id, {}, now);
    await this.audit.record(
      {
        actorType: "PAYMENT_PROVIDER",
        actorUserId: null,
        action: "order.paid",
        targetType: "order",
        targetId: order.publicId,
        metadata: { paymentId: payment.publicId, outcome },
      },
      tx,
    );
    return "success";
  }

  /** Opens a hosted payment page for an unpaid order (offer or gift card) of this customer. */
  async startOrderSession(
    orderPublicId: string,
    user: { id: bigint },
    ip: string | null,
    now: Date = new Date(),
  ): Promise<PaymentSessionResponse> {
    const provider = this.provider;
    if (!provider) {
      throw new ProblemException(
        503,
        "payments-unavailable",
        "Online payment is not available yet",
      );
    }
    const prepared = await this.db.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { publicId: orderPublicId, userId: user.id },
        include: { offer: { select: { titleEn: true } } },
      });
      if (!order) throw new ProblemException(404, "order-not-found", "Order not found");
      if (
        order.status !== "PENDING_PAYMENT" ||
        order.expiresAt.getTime() - now.getTime() < MIN_HOLD_LEFT_MS
      ) {
        throw new ProblemException(409, "order-not-payable", "This order cannot be paid");
      }
      const publicId = newPublicId();
      await tx.payment.create({
        data: {
          publicId,
          orderId: order.id,
          provider: provider.name,
          providerTxnId: publicId,
          amountMinor: order.amountMinor,
          currency: order.currency,
        },
      });
      await this.audit.record(
        {
          actorType: "CUSTOMER",
          actorUserId: user.id,
          action: "payment.started",
          targetType: "order",
          targetId: order.publicId,
          ipAddress: ip,
          metadata: { paymentId: publicId, provider: provider.name },
        },
        tx,
      );
      return { order, paymentPublicId: publicId };
    });
    const base = this.config.PUBLIC_BASE_URL!.replace(/\/$/, "");
    const callback = (path: string) => `${base}/api/v1/payments/${provider.name}/${path}`;
    const o = prepared.order;
    try {
      const session = await provider.createSession({
        tranId: prepared.paymentPublicId,
        amountMinor: o.amountMinor,
        currency: o.currency,
        booking: {
          reference: o.reference,
          productName:
            o.kind === "GIFT_CARD" ? "Pegah gift card" : (o.offer?.titleEn ?? "Pegah offer"),
          productType: o.kind,
        },
        customer: { name: o.buyerName, email: o.buyerEmail, phone: o.buyerPhone },
        urls: {
          success: callback("return/success"),
          fail: callback("return/fail"),
          cancel: callback("return/cancel"),
          ipn: callback("ipn"),
        },
      });
      await this.db.payment.update({
        where: { publicId: prepared.paymentPublicId },
        data: { status: "PENDING", providerSession: session.sessionKey },
      });
      return {
        paymentId: prepared.paymentPublicId,
        provider: provider.name,
        mode: provider.mode,
        redirectUrl: session.redirectUrl,
      };
    } catch (error) {
      const reason = error instanceof ProviderError ? error.message : "Provider call failed";
      await this.db.payment.update({
        where: { publicId: prepared.paymentPublicId },
        data: { status: "FAILED", failureReason: reason.slice(0, 255) },
      });
      throw new ProblemException(502, "payment-provider-error", "Could not open the payment page");
    }
  }

  /** Applies a provider-verified outcome. All booking changes go through the state machine. */
  async applyVerification(
    paymentId: bigint,
    v: Verification,
    now: Date = new Date(),
  ): Promise<CallbackResult["outcome"]> {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM payments WHERE id = ${paymentId} FOR UPDATE`;
      const payment = await tx.payment.findUniqueOrThrow({
        where: { id: paymentId },
        include: { booking: true, order: true },
      });
      if (v.tranId !== null && v.tranId !== payment.providerTxnId) return "unknown";

      if (v.status === "PENDING" || v.status === "UNKNOWN") return "pending";

      if (v.status === "FAILED" || v.status === "CANCELLED") {
        await tx.payment.updateMany({
          where: { id: payment.id, status: { in: ["INITIATED", "PENDING"] } },
          data: {
            status: v.status === "FAILED" ? "FAILED" : "CANCELLED",
            failureReason: v.reason?.slice(0, 255) ?? null,
          },
        });
        return v.status === "FAILED" ? "failed" : "cancelled";
      }

      // VALID from here on.
      if (payment.order) return this.applyOrderPayment(tx, payment, payment.order, v, now);
      const booking = payment.booking!;
      if (payment.status === "SUCCEEDED" || payment.status === "REFUND_REQUIRED") {
        return booking.status === "CONFIRMED" ? "success" : "review";
      }
      const amountOk =
        v.amountMinor === payment.amountMinor && v.amountMinor === booking.totalMinor;
      const currencyOk = v.currency === payment.currency && v.currency === booking.currency;
      const riskOk = (v.riskLevel ?? 0) === 0;
      const payable = booking.status === "PENDING_PAYMENT";
      const paidFields = {
        providerValId: v.valId,
        bankTxnId: v.bankTxnId?.slice(0, 80) ?? null,
        riskLevel: v.riskLevel,
        method: v.method?.slice(0, 60) ?? null,
        succeededAt: now,
      };
      const actor = { type: "PAYMENT_PROVIDER" as const, userId: null };

      if (!payable || !amountOk || !currencyOk) {
        const reason = !payable
          ? `Paid after the booking became ${booking.status}`
          : "Paid amount or currency does not match the booking";
        await tx.payment.update({
          where: { id: payment.id },
          data: { ...paidFields, status: "REFUND_REQUIRED", failureReason: reason },
        });
        if (payable) {
          // Money arrived but not the right amount: a person must decide.
          await this.moveToReview(tx, booking.publicId, reason, now);
        }
        await this.recordPaymentEvent(
          tx,
          "payment.refund_required",
          booking.publicId,
          payment.publicId,
          {
            reason,
            paidMinor: v.amountMinor?.toString() ?? null,
          },
        );
        return "review";
      }

      await tx.payment.update({
        where: { id: payment.id },
        data: { ...paidFields, status: "SUCCEEDED" },
      });
      await this.status.transitionInTx(
        tx,
        {
          bookingPublicId: booking.publicId,
          to: "PAYMENT_PROCESSING",
          expectedStatus: "PENDING_PAYMENT",
          actor: { type: "SYSTEM", userId: null },
          reason: `Payment ${payment.publicId} verified with ${payment.provider}`,
        },
        now,
      );
      if (!riskOk) {
        await this.status.transitionInTx(
          tx,
          {
            bookingPublicId: booking.publicId,
            to: "MANUAL_REVIEW",
            expectedStatus: "PAYMENT_PROCESSING",
            actor,
            reason: `Provider flagged the payment as risky (risk level ${v.riskLevel})`,
          },
          now,
        );
        await this.recordPaymentEvent(
          tx,
          "payment.review_required",
          booking.publicId,
          payment.publicId,
          {
            riskLevel: v.riskLevel,
          },
        );
        return "review";
      }
      await this.status.transitionInTx(
        tx,
        {
          bookingPublicId: booking.publicId,
          to: "CONFIRMED",
          expectedStatus: "PAYMENT_PROCESSING",
          actor,
          reason: "Payment received and verified",
        },
        now,
      );
      await this.recordPaymentEvent(tx, "booking.confirmed", booking.publicId, payment.publicId, {
        totalMinor: booking.totalMinor.toString(),
        currency: booking.currency,
      });
      return "success";
    });
  }

  private async moveToReview(tx: Tx, bookingPublicId: string, reason: string, now: Date) {
    await this.status.transitionInTx(
      tx,
      {
        bookingPublicId,
        to: "PAYMENT_PROCESSING",
        expectedStatus: "PENDING_PAYMENT",
        actor: { type: "SYSTEM", userId: null },
        reason: "Payment received; needs review",
      },
      now,
    );
    await this.status.transitionInTx(
      tx,
      {
        bookingPublicId,
        to: "MANUAL_REVIEW",
        expectedStatus: "PAYMENT_PROCESSING",
        actor: { type: "PAYMENT_PROVIDER", userId: null },
        reason,
      },
      now,
    );
  }

  /** Outbox (for the worker: emails, refunds) + audit, in the caller's transaction. */
  private async recordPaymentEvent(
    tx: Tx,
    eventType: string,
    bookingPublicId: string,
    paymentPublicId: string,
    data: Record<string, string | number | null>,
  ) {
    await tx.outboxEvent.create({
      data: {
        eventType,
        aggregateType: "booking",
        aggregateId: bookingPublicId,
        payload: { bookingId: bookingPublicId, paymentId: paymentPublicId, ...data },
      },
    });
    await this.audit.record(
      {
        actorType: "PAYMENT_PROVIDER",
        action: eventType,
        targetType: "booking",
        targetId: bookingPublicId,
        metadata: { paymentId: paymentPublicId, ...data },
      },
      tx,
    );
  }

  private async finishEvent(id: bigint, outcome: string, now: Date) {
    await this.db.paymentEvent.update({
      where: { id },
      data: { processedAt: now, outcome: outcome.slice(0, 80) },
    });
  }
}

function sanitize(raw: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of [...KEEP_FIELDS, "verify_sign", "verify_key"]) {
    const v = raw[key];
    if (typeof v === "string" && v.length <= 500) out[key] = v;
  }
  return out;
}

function stringFields(raw: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "string" && k.length <= 64 && v.length <= 2000) out[k] = v;
  }
  return out;
}
