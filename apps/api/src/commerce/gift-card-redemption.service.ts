import { Inject, Injectable } from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import { BookingStatusService } from "../booking/booking-status.service";
import { newPublicId } from "../common/ids";
import { toMoney } from "../common/money";
import { ProblemException } from "../common/problem";
import { PaymentService } from "../payments/payment.service";
import { PRISMA, type Db } from "../prisma/prisma.service";
import { hashCode } from "./gift-card.service";
import {
  GIFT_CARD_PROVIDER,
  giftCardAppliedMinor,
  releaseGiftCardPayments,
} from "./gift-card-ledger";

const MIN_HOLD_LEFT_MS = 60_000;

/**
 * Paying for a booking with a gift card (ADR-0034). The card is debited and a
 * GIFT_CARD payment row records it, in one transaction with row locks on the
 * booking and the card. When cards cover the whole total the booking is
 * confirmed through the state machine; otherwise online payment is asked only
 * for what is left. Unsold bookings return the money to the cards
 * (BookingStatusService).
 */
@Injectable()
export class GiftCardRedemption {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(BookingStatusService) private readonly status: BookingStatusService,
    @Inject(PaymentService) private readonly payments: PaymentService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async apply(
    bookingPublicId: string,
    code: string,
    user: { id: bigint },
    ip: string | null,
    now: Date = new Date(),
  ) {
    const owned = await this.db.booking.findFirst({
      where: { publicId: bookingPublicId, userId: user.id },
      select: { id: true },
    });
    if (!owned) throw new ProblemException(404, "booking-not-found", "Booking not found");
    // A payment page may have been completed meanwhile: settle that first (outside any transaction).
    await this.payments.reconcileBooking(owned.id, now);

    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM bookings WHERE id = ${owned.id} FOR UPDATE`;
      const booking = await tx.booking.findUniqueOrThrow({ where: { id: owned.id } });
      this.assertPayable(booking, now);

      const codeHash = hashCode(code);
      await tx.$queryRaw`SELECT id FROM gift_cards WHERE code_hash = ${codeHash} FOR UPDATE`;
      const card = await tx.giftCard.findUnique({ where: { codeHash } });
      // Unknown, void and expired cards get the same answer: no hints for guessing codes.
      if (!card || card.status !== "ACTIVE" || card.expiresAt <= now) {
        throw new ProblemException(
          404,
          "gift-card-not-found",
          "We could not use that gift card",
          "Check the code. Cards that are void or past their date cannot be used.",
        );
      }
      if (card.balanceMinor <= 0n) {
        throw new ProblemException(409, "gift-card-empty", "This gift card has no balance left");
      }
      if (card.currency !== booking.currency) {
        throw new ProblemException(
          422,
          "currency-mismatch",
          "This gift card is in another currency",
        );
      }
      const dueBefore = booking.totalMinor - (await giftCardAppliedMinor(tx, booking.id));
      if (dueBefore <= 0n) {
        throw new ProblemException(409, "booking-not-payable", "Nothing left to pay");
      }
      const amount = card.balanceMinor < dueBefore ? card.balanceMinor : dueBefore;
      const balanceAfter = card.balanceMinor - amount;

      await tx.giftCard.update({ where: { id: card.id }, data: { balanceMinor: balanceAfter } });
      await tx.giftCardTxn.create({
        data: {
          giftCardId: card.id,
          kind: "REDEEM",
          amountMinor: -amount,
          balanceAfter,
          bookingId: booking.id,
          note: "Paid for a booking",
        },
      });
      const paymentPublicId = newPublicId();
      await tx.payment.create({
        data: {
          publicId: paymentPublicId,
          bookingId: booking.id,
          giftCardId: card.id,
          provider: GIFT_CARD_PROVIDER,
          providerTxnId: paymentPublicId,
          amountMinor: amount,
          currency: booking.currency,
          status: "SUCCEEDED",
          method: `Gift card ••${card.last4}`,
          succeededAt: now,
        },
      });
      // An open payment page was for the old amount: it can no longer confirm this booking.
      await tx.payment.updateMany({
        where: {
          bookingId: booking.id,
          provider: { not: GIFT_CARD_PROVIDER },
          status: { in: ["INITIATED", "PENDING"] },
        },
        data: { status: "CANCELLED", failureReason: "Replaced: a gift card was applied" },
      });
      await this.audit.record(
        {
          actorType: "CUSTOMER",
          actorUserId: user.id,
          action: "giftcard.redeemed",
          targetType: "booking",
          targetId: booking.publicId,
          ipAddress: ip,
          metadata: {
            giftCardId: card.publicId,
            paymentId: paymentPublicId,
            amountMinor: amount.toString(),
          },
        },
        tx,
      );

      const dueAfter = dueBefore - amount;
      let bookingStatus: string = booking.status;
      if (dueAfter === 0n) {
        await this.status.transitionInTx(
          tx,
          {
            bookingPublicId: booking.publicId,
            to: "PAYMENT_PROCESSING",
            expectedStatus: "PENDING_PAYMENT",
            actor: { type: "SYSTEM", userId: null },
            reason: `Paid in full by gift card (${paymentPublicId})`,
          },
          now,
        );
        await this.payments.confirmInTx(
          tx,
          booking,
          paymentPublicId,
          "Paid in full by gift card",
          now,
        );
        bookingStatus = "CONFIRMED";
      }
      return {
        applied: toMoney(amount, booking.currency),
        amountDue: toMoney(dueAfter, booking.currency),
        cardBalance: toMoney(balanceAfter, card.currency),
        bookingStatus,
      };
    });
  }

  /** Takes one gift card off an unpaid booking; the money returns to the card. */
  async remove(
    bookingPublicId: string,
    paymentPublicId: string,
    user: { id: bigint },
    ip: string | null,
  ): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const owned = await tx.booking.findFirst({
        where: { publicId: bookingPublicId, userId: user.id },
        select: { id: true },
      });
      if (!owned) throw new ProblemException(404, "booking-not-found", "Booking not found");
      await tx.$queryRaw`SELECT id FROM bookings WHERE id = ${owned.id} FOR UPDATE`;
      const booking = await tx.booking.findUniqueOrThrow({ where: { id: owned.id } });
      if (booking.status !== "PENDING_PAYMENT") {
        throw new ProblemException(
          409,
          "booking-not-payable",
          "This booking is no longer awaiting payment",
        );
      }
      const payment = await tx.payment.findFirst({
        where: {
          publicId: paymentPublicId,
          bookingId: booking.id,
          provider: GIFT_CARD_PROVIDER,
          status: "SUCCEEDED",
        },
        select: { id: true },
      });
      if (!payment)
        throw new ProblemException(404, "payment-not-found", "Gift card payment not found");
      await releaseGiftCardPayments(tx, booking.id, "Removed by the customer", {
        paymentId: payment.id,
      });
      await tx.payment.updateMany({
        where: {
          bookingId: booking.id,
          provider: { not: GIFT_CARD_PROVIDER },
          status: { in: ["INITIATED", "PENDING"] },
        },
        data: { status: "CANCELLED", failureReason: "Replaced: a gift card was removed" },
      });
      await this.audit.record(
        {
          actorType: "CUSTOMER",
          actorUserId: user.id,
          action: "giftcard.redemption_removed",
          targetType: "booking",
          targetId: booking.publicId,
          ipAddress: ip,
          metadata: { paymentId: paymentPublicId },
        },
        tx,
      );
    });
  }

  private assertPayable(booking: { status: string; holdExpiresAt: Date | null }, now: Date) {
    if (booking.status !== "PENDING_PAYMENT") {
      throw new ProblemException(
        409,
        "booking-not-payable",
        "This booking is not awaiting payment",
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
  }
}
