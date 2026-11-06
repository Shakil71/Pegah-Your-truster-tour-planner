import type { Tx } from "../booking/inventory";

/** `payments.provider` for amounts paid from a gift card (ADR-0034). */
export const GIFT_CARD_PROVIDER = "GIFT_CARD";

/** Sum of gift card money currently applied to a booking. */
export async function giftCardAppliedMinor(tx: Tx, bookingId: bigint): Promise<bigint> {
  const rows = await tx.payment.findMany({
    where: { bookingId, provider: GIFT_CARD_PROVIDER, status: "SUCCEEDED" },
    select: { amountMinor: true },
  });
  return rows.reduce((sum, r) => sum + r.amountMinor, 0n);
}

/**
 * Credits up to `maxMinor` of an approved refund back to the gift cards that
 * paid for a confirmed booking (ADR-0037), oldest card payment first. Each
 * card gets back at most what it paid for this booking, minus earlier refunds
 * to it. Void or expired cards are skipped, so that share stays a normal
 * (manual) refund. Each credit is a REFUND ledger row plus an already-PAID
 * refund row. Runs in the caller's transaction; returns the amount credited.
 */
export async function refundToGiftCards(
  tx: Tx,
  booking: { id: bigint; currency: string },
  maxMinor: bigint,
  reason: string,
  staffUserId: bigint,
  now: Date,
  newRefundId: () => string,
): Promise<bigint> {
  if (maxMinor <= 0n) return 0n;
  const payments = await tx.payment.findMany({
    where: { bookingId: booking.id, provider: GIFT_CARD_PROVIDER, status: "SUCCEEDED" },
    select: { amountMinor: true, giftCardId: true },
    orderBy: { id: "asc" },
  });
  const paidByCard = new Map<bigint, bigint>();
  for (const p of payments) {
    paidByCard.set(p.giftCardId!, (paidByCard.get(p.giftCardId!) ?? 0n) + p.amountMinor);
  }
  let left = maxMinor;
  for (const [cardId, paid] of paidByCard) {
    if (left === 0n) break;
    const earlier = await tx.refund.aggregate({
      where: { bookingId: booking.id, giftCardId: cardId },
      _sum: { amountMinor: true },
    });
    const room = paid - (earlier._sum.amountMinor ?? 0n);
    if (room <= 0n) continue;
    await tx.$queryRaw`SELECT id FROM gift_cards WHERE id = ${cardId} FOR UPDATE`;
    const card = await tx.giftCard.findUniqueOrThrow({
      where: { id: cardId },
      select: { status: true, balanceMinor: true, expiresAt: true, currency: true },
    });
    if (card.status !== "ACTIVE" || card.expiresAt <= now || card.currency !== booking.currency) {
      continue;
    }
    const credit = room < left ? room : left;
    const balanceAfter = card.balanceMinor + credit;
    await tx.giftCard.update({ where: { id: cardId }, data: { balanceMinor: balanceAfter } });
    await tx.giftCardTxn.create({
      data: {
        giftCardId: cardId,
        kind: "REFUND",
        amountMinor: credit,
        balanceAfter,
        bookingId: booking.id,
        note: `Refund: ${reason}`.slice(0, 200),
      },
    });
    await tx.refund.create({
      data: {
        publicId: newRefundId(),
        bookingId: booking.id,
        amountMinor: credit,
        currency: booking.currency,
        reason,
        status: "PAID",
        providerRef: GIFT_CARD_PROVIDER,
        giftCardId: cardId,
        approvedById: staffUserId,
        paidById: staffUserId,
        paidAt: now,
      },
    });
    left -= credit;
  }
  return maxMinor - left;
}

/**
 * Gives gift card money back to the cards when a booking ends without a sale
 * (expired, failed, cancelled before confirmation), or when the customer
 * removes one card. Runs in the caller's transaction; each release is a
 * RELEASE ledger row, and the payment row becomes CANCELLED. A card voided in
 * the meantime keeps a zero balance (the ledger notes it).
 */
export async function releaseGiftCardPayments(
  tx: Tx,
  bookingId: bigint,
  reason: string,
  only?: { paymentId: bigint },
): Promise<number> {
  const payments = await tx.payment.findMany({
    where: {
      bookingId,
      provider: GIFT_CARD_PROVIDER,
      status: "SUCCEEDED",
      ...(only ? { id: only.paymentId } : {}),
    },
    select: { id: true, amountMinor: true, giftCardId: true },
    orderBy: { id: "asc" },
  });
  for (const p of payments) {
    const cardId = p.giftCardId!;
    await tx.$queryRaw`SELECT id FROM gift_cards WHERE id = ${cardId} FOR UPDATE`;
    const card = await tx.giftCard.findUniqueOrThrow({
      where: { id: cardId },
      select: { status: true, balanceMinor: true },
    });
    const restore = card.status === "ACTIVE";
    const balanceAfter = restore ? card.balanceMinor + p.amountMinor : card.balanceMinor;
    if (restore) {
      await tx.giftCard.update({ where: { id: cardId }, data: { balanceMinor: balanceAfter } });
    }
    await tx.giftCardTxn.create({
      data: {
        giftCardId: cardId,
        kind: "RELEASE",
        amountMinor: restore ? p.amountMinor : 0n,
        balanceAfter,
        bookingId,
        note: (restore ? reason : `${reason} (card is void; not restored)`).slice(0, 200),
      },
    });
    await tx.payment.update({
      where: { id: p.id },
      data: {
        status: "CANCELLED",
        failureReason: `Returned to the gift card: ${reason}`.slice(0, 255),
      },
    });
  }
  return payments.length;
}
