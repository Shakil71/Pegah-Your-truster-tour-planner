import { Inject, Injectable } from "@nestjs/common";
import type { CancellationDecision } from "@pegah/contracts";
import type { Prisma } from "@pegah/db";
import { AuditService } from "../audit/audit.service";
import type { AuthContext } from "../auth/auth.types";
import { BookingStatusService } from "../booking/booking-status.service";
import type { Tx } from "../booking/inventory";
import { refundToGiftCards } from "../commerce/gift-card-ledger";
import { newPublicId } from "../common/ids";
import { ProblemException } from "../common/problem";
import { dhakaToday } from "../common/time";
import { taka } from "../email/outbox-dispatcher.service";
import { PRISMA, type Db } from "../prisma/prisma.service";

/**
 * Cancellation of confirmed bookings and the refund workflow (ADR-0024):
 *  customer requests (CONFIRMED → CANCELLATION_REQUESTED) →
 *  staff approves (→ CANCELLED, sold inventory released; refund > 0 →
 *  REFUND_PENDING + refund row) or rejects (→ CONFIRMED) →
 *  finance marks the refund paid (→ REFUNDED when nothing is pending).
 * The gift card share of a refund is credited to the card at approval and
 * recorded as a PAID refund (ADR-0037); if nothing else is owed, the booking
 * goes straight to REFUNDED.
 * Every step uses the booking state machine, is audited, and writes an
 * outbox event for the customer email, all in one transaction.
 */
@Injectable()
export class CancellationService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(BookingStatusService) private readonly status: BookingStatusService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async request(
    bookingPublicId: string,
    auth: AuthContext,
    reason: string,
    ip: string | null,
    now = new Date(),
  ) {
    await this.db.$transaction(async (tx) => {
      const b = await tx.booking.findFirst({
        where: { publicId: bookingPublicId, userId: auth.user.id },
      });
      if (!b) throw new ProblemException(404, "booking-not-found", "Booking not found");
      if (b.status !== "CONFIRMED") {
        throw new ProblemException(
          409,
          "not-cancellable",
          "This booking cannot be cancelled online",
          b.status === "PENDING_PAYMENT"
            ? "Unpaid holds can be cancelled directly."
            : `The booking is ${b.status.toLowerCase().replaceAll("_", " ")}.`,
        );
      }
      if (b.startDate <= dhakaToday(now)) {
        throw new ProblemException(
          422,
          "trip-started",
          "The trip has started",
          "Contact us to change a trip that has started.",
        );
      }
      await this.status.transitionInTx(
        tx,
        {
          bookingPublicId,
          to: "CANCELLATION_REQUESTED",
          expectedStatus: "CONFIRMED",
          actor: { type: "CUSTOMER", userId: auth.user.id },
          reason,
          ipAddress: ip,
          ownerUserId: auth.user.id,
        },
        now,
      );
      await outbox(tx, "booking.cancellation_requested", bookingPublicId, { reason });
    });
  }

  async decide(
    bookingPublicId: string,
    input: CancellationDecision,
    auth: AuthContext,
    ip: string | null,
    now = new Date(),
  ) {
    await this.db.$transaction(async (tx) => {
      const b = await tx.booking.findUnique({
        where: { publicId: bookingPublicId },
        include: { payments: { where: { status: "SUCCEEDED" } }, refunds: true },
      });
      if (!b) throw new ProblemException(404, "booking-not-found", "Booking not found");
      const actor = { type: "STAFF" as const, userId: auth.user.id };

      if (!input.approve) {
        await this.status.transitionInTx(
          tx,
          {
            bookingPublicId,
            to: "CONFIRMED",
            expectedStatus: input.expectedStatus,
            actor,
            reason: input.reason,
            ipAddress: ip,
          },
          now,
        );
        await outbox(tx, "booking.cancellation_rejected", bookingPublicId, {
          reason: input.reason,
        });
        return;
      }

      const refundMinor = BigInt(input.refund?.amountMinor ?? 0);
      if (input.refund && input.refund.currency !== b.currency) {
        throw new ProblemException(
          422,
          "currency-mismatch",
          "Wrong currency",
          `This booking was paid in ${b.currency}.`,
        );
      }
      // Never refund more than was paid (or the total, for staff-confirmed bookings without an online payment).
      const paid = b.payments.reduce((a, p) => a + p.amountMinor, 0n);
      const ceiling =
        (paid > 0n ? paid : b.totalMinor) - b.refunds.reduce((a, r) => a + r.amountMinor, 0n);
      if (refundMinor > ceiling) {
        throw new ProblemException(
          422,
          "refund-too-large",
          "Refund exceeds the amount paid",
          `At most ${taka(ceiling.toString(), b.currency)} can be refunded.`,
        );
      }
      await this.status.transitionInTx(
        tx,
        {
          bookingPublicId,
          to: "CANCELLED",
          expectedStatus: input.expectedStatus,
          actor,
          reason: input.reason,
          ipAddress: ip,
        },
        now,
      );
      // The gift card share goes straight back to the card(s) (ADR-0037); the rest is a manual refund.
      const giftCardMinor = await refundToGiftCards(
        tx,
        b,
        refundMinor,
        input.reason,
        auth.user.id,
        now,
        newPublicId,
      );
      const manualMinor = refundMinor - giftCardMinor;
      if (manualMinor > 0n) {
        await tx.refund.create({
          data: {
            publicId: newPublicId(),
            bookingId: b.id,
            amountMinor: manualMinor,
            currency: b.currency,
            reason: input.reason,
            approvedById: auth.user.id,
          },
        });
      }
      if (refundMinor > 0n) {
        await this.status.transitionInTx(
          tx,
          {
            bookingPublicId,
            to: "REFUND_PENDING",
            expectedStatus: "CANCELLED",
            actor,
            reason: `Refund approved: ${taka(refundMinor.toString(), b.currency)}`,
            ipAddress: ip,
          },
          now,
        );
        if (manualMinor === 0n) {
          await this.status.transitionInTx(
            tx,
            {
              bookingPublicId,
              to: "REFUNDED",
              expectedStatus: "REFUND_PENDING",
              actor,
              reason: "Refund credited to the gift card",
              ipAddress: ip,
            },
            now,
          );
        }
      }
      await outbox(tx, "booking.cancelled", bookingPublicId, {
        refundMinor: refundMinor.toString(),
        giftCardMinor: giftCardMinor.toString(),
        currency: b.currency,
      });
    });
  }

  async markRefundPaid(
    refundPublicId: string,
    providerRef: string,
    auth: AuthContext,
    ip: string | null,
    now = new Date(),
  ) {
    await this.db.$transaction(async (tx) => {
      const r = await tx.refund.findUnique({
        where: { publicId: refundPublicId },
        include: { booking: true },
      });
      if (!r) throw new ProblemException(404, "refund-not-found", "Refund not found");
      const updated = await tx.refund.updateMany({
        where: { id: r.id, status: "PENDING" },
        data: { status: "PAID", providerRef, paidById: auth.user.id, paidAt: now },
      });
      if (updated.count !== 1)
        throw new ProblemException(
          409,
          "refund-already-paid",
          "This refund is already marked paid",
        );
      await this.audit.record(
        {
          actorType: "STAFF",
          actorUserId: auth.user.id,
          action: "refund.paid",
          targetType: "booking",
          targetId: r.booking.publicId,
          ipAddress: ip,
          metadata: { refundId: r.publicId, amountMinor: r.amountMinor.toString(), providerRef },
        },
        tx,
      );
      const stillPending = await tx.refund.count({
        where: { bookingId: r.bookingId, status: "PENDING" },
      });
      if (stillPending === 0 && r.booking.status === "REFUND_PENDING") {
        await this.status.transitionInTx(
          tx,
          {
            bookingPublicId: r.booking.publicId,
            to: "REFUNDED",
            expectedStatus: "REFUND_PENDING",
            actor: { type: "STAFF", userId: auth.user.id },
            reason: `Refund paid (${providerRef})`,
            ipAddress: ip,
          },
          now,
        );
      }
      await outbox(tx, "refund.paid", r.booking.publicId, {
        amountMinor: r.amountMinor.toString(),
        currency: r.currency,
      });
    });
  }
}

function outbox(
  tx: Tx,
  eventType: string,
  bookingPublicId: string,
  payload: Prisma.InputJsonObject,
) {
  return tx.outboxEvent.create({
    data: {
      eventType,
      aggregateType: "booking",
      aggregateId: bookingPublicId,
      payload: { bookingId: bookingPublicId, ...payload },
    },
  });
}
