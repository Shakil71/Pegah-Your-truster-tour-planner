import { Inject, Injectable } from "@nestjs/common";
import type { HotelQuoteQuery, Quote, TourQuoteQuery } from "@pegah/contracts";
import { ProblemException } from "../common/problem";
import { parseStay } from "../common/stay-dates";
import { priceWithDiscount } from "../pricing/pricing";
import { PRISMA, type Db } from "../prisma/prisma.service";
import { PromotionRejected, PromotionService } from "../promotions/promotion.service";
import { evaluateDeparture, evaluateStay, hotelQuote, tourQuote, type QuotePromo } from "./offer";

/**
 * Indicative prices for the checkout page. Nothing is held or reserved. A
 * promo code is checked with the same rules as booking creation; when it does
 * not apply, the quote carries the reason and the undiscounted price.
 */
@Injectable()
export class QuoteService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(PromotionService) private readonly promotions: PromotionService,
  ) {}

  async hotel(
    q: HotelQuoteQuery,
    userId: bigint | null = null,
    now: Date = new Date(),
  ): Promise<Quote> {
    const stay = parseStay(q.checkIn, q.checkOut, now);
    const room = await this.db.hotelRoom.findFirst({
      where: {
        publicId: q.roomId,
        isActive: true,
        hotel: { status: "PUBLISHED", destination: { status: "PUBLISHED" } },
      },
      include: { hotel: true },
    });
    if (!room) throw new ProblemException(404, "room-not-found", "Room not found");
    const params = { ...stay, rooms: q.rooms, adults: q.adults, children: q.children };
    const result = await evaluateStay(this.db, room, params);
    const promo =
      result.ok && q.promoCode
        ? await this.promo(q.promoCode, {
            productType: "HOTEL",
            baseMinor: result.price.baseMinor,
            currency: room.hotel.currency,
            userId,
            now,
            serviceChargeBps: room.hotel.serviceChargeBps,
            vatBps: room.hotel.vatBps,
          })
        : undefined;
    return hotelQuote(room, params, result, now, promo);
  }

  async tour(
    q: TourQuoteQuery,
    userId: bigint | null = null,
    now: Date = new Date(),
  ): Promise<Quote> {
    const s = await this.db.tourSchedule.findFirst({
      where: {
        publicId: q.departureId,
        tour: { status: "PUBLISHED", destination: { status: "PUBLISHED" } },
      },
      include: { tour: true },
    });
    if (!s) throw new ProblemException(404, "departure-not-found", "Departure not found");
    const result = evaluateDeparture(s, q.adults, q.children, now);
    const promo =
      result.ok && q.promoCode
        ? await this.promo(q.promoCode, {
            productType: "TOUR",
            baseMinor: result.price.baseMinor,
            currency: s.currency,
            userId,
            now,
            serviceChargeBps: 0,
            vatBps: s.tour.vatBps,
          })
        : undefined;
    return tourQuote(s, q.adults, q.children, result, now, promo);
  }

  private async promo(
    code: string,
    ctx: {
      productType: "HOTEL" | "TOUR";
      baseMinor: bigint;
      currency: string;
      userId: bigint | null;
      now: Date;
      serviceChargeBps: number;
      vatBps: number;
    },
  ): Promise<QuotePromo> {
    try {
      const { promotion, discountMinor } = await this.promotions.resolve(this.db, code, ctx);
      return {
        applied: {
          code: promotion.code,
          name: promotion.name,
          price: priceWithDiscount({
            baseMinor: ctx.baseMinor,
            discountMinor,
            serviceChargeBps: ctx.serviceChargeBps,
            vatBps: ctx.vatBps,
          }),
        },
      };
    } catch (error) {
      if (error instanceof PromotionRejected)
        return { error: error.detail ?? "Code not applicable" };
      throw error;
    }
  }
}
