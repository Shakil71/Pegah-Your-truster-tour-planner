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
