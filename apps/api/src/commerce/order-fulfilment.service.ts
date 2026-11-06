import { Inject, Injectable } from "@nestjs/common";
import type { Tx } from "../booking/inventory";
import { GiftCardService } from "./gift-card.service";

/**
 * The one place an order becomes PAID (ADR-0032): from a verified online
 * payment or from staff recording an offline payment. In the caller's
 * transaction it marks the order paid, issues the gift card (once — the
 * unique order_id guarantees it) and queues one outbox event per email, so a
 * failed email is retried on its own and nothing is sent twice.
 */
@Injectable()
export class OrderFulfilment {
  constructor(@Inject(GiftCardService) private readonly giftCards: GiftCardService) {}

  async markPaidInTx(
    tx: Tx,
    orderId: bigint,
    how: { offline?: string },
    now: Date = new Date(),
  ): Promise<"paid" | "already-paid" | "not-payable"> {
    await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`;
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { giftCard: true },
    });
    if (order.status === "PAID") return "already-paid";
    if (order.status !== "PENDING_PAYMENT") return "not-payable";

    await tx.order.update({
      where: { id: order.id },
      data: { status: "PAID", paidAt: now, paidOffline: how.offline?.slice(0, 200) ?? null },
    });
    const events: {
      eventType: string;
      aggregateType: string;
      aggregateId: string;
      payload: object;
    }[] = [
      {
        eventType: "order.paid.buyer",
        aggregateType: "order",
        aggregateId: order.publicId,
        payload: {},
      },
      {
        eventType: "order.paid.staff",
        aggregateType: "order",
        aggregateId: order.publicId,
        payload: {},
      },
    ];
    if (order.kind === "GIFT_CARD" && !order.giftCard) {
      const card = await this.giftCards.issueInTx(
        tx,
        {
          amountMinor: order.amountMinor,
          currency: order.currency,
          recipientName: order.recipientName ?? order.buyerName,
          recipientEmail: order.recipientEmail ?? order.buyerEmail,
          orderId: order.id,
          note: `Purchased with order ${order.reference}`,
        },
        now,
      );
      events.push({
        eventType: "giftcard.deliver",
        aggregateType: "gift_card",
        aggregateId: card.publicId,
        payload: { message: order.giftMessage, from: order.buyerName },
      });
    }
    await tx.outboxEvent.createMany({ data: events });
    return "paid";
  }
}
