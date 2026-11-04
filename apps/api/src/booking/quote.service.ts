import { Inject, Injectable } from "@nestjs/common";
import type { HotelQuoteQuery, Quote, TourQuoteQuery } from "@pegah/contracts";
import { ProblemException } from "../common/problem";
import { parseStay } from "../common/stay-dates";
import { PRISMA, type Db } from "../prisma/prisma.service";
import { evaluateDeparture, evaluateStay, hotelQuote, tourQuote } from "./offer";

/** Indicative prices for the checkout page. Nothing is held or reserved. */
@Injectable()
export class QuoteService {
  constructor(@Inject(PRISMA) private readonly db: Db) {}

  async hotel(q: HotelQuoteQuery, now: Date = new Date()): Promise<Quote> {
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
    return hotelQuote(room, params, await evaluateStay(this.db, room, params), now);
  }

  async tour(q: TourQuoteQuery, now: Date = new Date()): Promise<Quote> {
    const s = await this.db.tourSchedule.findFirst({
      where: {
        publicId: q.departureId,
        tour: { status: "PUBLISHED", destination: { status: "PUBLISHED" } },
      },
      include: { tour: true },
    });
    if (!s) throw new ProblemException(404, "departure-not-found", "Departure not found");
    return tourQuote(s, q.adults, q.children, evaluateDeparture(s, q.adults, q.children, now), now);
  }
}
