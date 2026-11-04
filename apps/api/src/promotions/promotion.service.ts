import { Injectable } from "@nestjs/common";
import type { BookingStatus, Prisma, Promotion } from "@pegah/db";
import { ProblemException } from "../common/problem";
import { taka } from "../email/outbox-dispatcher.service";
import { promotionDiscount } from "../pricing/pricing";

/** Bookings that use up a redemption (expired, failed and cancelled ones give it back). */
export const REDEEMING: BookingStatus[] = [
  "PENDING_AVAILABILITY",
  "PENDING_PAYMENT",
  "PAYMENT_PROCESSING",
  "CONFIRMED",
  "COMPLETED",
  "MANUAL_REVIEW",
  "CANCELLATION_REQUESTED",
  "REFUND_PENDING",
  "REFUNDED",
];

type Reader = Pick<Prisma.TransactionClient, "promotion" | "booking" | "$queryRaw">;

export interface PromotionContext {
  productType: "HOTEL" | "TOUR";
  baseMinor: bigint;
  currency: string;
  userId: bigint | null;
  now: Date;
  /** Lock the promotion row (booking creation) so limits hold under concurrency. */
  lock?: boolean;
}

export class PromotionRejected extends ProblemException {
  constructor(detail: string) {
    super(422, "promo-not-applicable", "Code not applicable", detail);
  }
}

/** Promotion rules (ADR-0025): window, status, scope, currency, minimum spend, usage limits. */
@Injectable()
export class PromotionService {
  async resolve(
    db: Reader,
    code: string,
    ctx: PromotionContext,
  ): Promise<{ promotion: Promotion; discountMinor: bigint }> {
    const found = await db.promotion.findUnique({ where: { code } });
    if (!found) throw new PromotionRejected("We do not recognise this code.");
    if (ctx.lock) await db.$queryRaw`SELECT id FROM promotions WHERE id = ${found.id} FOR UPDATE`;
    const p = found;
    if (p.status !== "ACTIVE" || ctx.now < p.startsAt || ctx.now >= p.endsAt) {
      throw new PromotionRejected("This code is not active right now.");
    }
    if (p.scope !== "ALL" && p.scope !== ctx.productType) {
      throw new PromotionRejected(
        `This code is only for ${p.scope === "HOTEL" ? "stays" : "tours"}.`,
      );
    }
    if (p.currency !== ctx.currency)
      throw new PromotionRejected("This code does not apply to this currency.");
    if (ctx.baseMinor < p.minSpendMinor) {
      throw new PromotionRejected(
        `Spend at least ${taka(p.minSpendMinor.toString(), p.currency)} before taxes to use this code.`,
      );
    }
    if (p.maxRedemptions !== null) {
      const used = await db.booking.count({
        where: { promotionId: p.id, status: { in: REDEEMING } },
      });
      if (used >= p.maxRedemptions) throw new PromotionRejected("This code has been fully used.");
    }
    if (ctx.userId !== null) {
      const mine = await db.booking.count({
        where: { promotionId: p.id, userId: ctx.userId, status: { in: REDEEMING } },
      });
      if (mine >= p.perCustomerLimit)
        throw new PromotionRejected("You have already used this code.");
    }
    const discountMinor = promotionDiscount(p, ctx.baseMinor);
    if (discountMinor <= 0n)
      throw new PromotionRejected("This code gives no discount on this booking.");
    return { promotion: p, discountMinor };
  }
}
