import { Inject, Injectable, Logger } from "@nestjs/common";
import type { BookingContact, CreateBookingRequest, GuestInput, Quote } from "@pegah/contracts";
import { Prisma } from "@pegah/db";
import { AuditService } from "../audit/audit.service";
import { newBookingReference, newPublicId } from "../common/ids";
import { ProblemException } from "../common/problem";
import { parseStay } from "../common/stay-dates";
import { dhakaToday, formatCalendarDate, stayNights } from "../common/time";
import { APP_CONFIG, type AppConfig } from "../config/config";
import { PRISMA, type Db } from "../prisma/prisma.service";
import { assertTransition } from "./booking-state-machine";
import { lockRoomNights, lockTourSchedule, type Tx } from "./inventory";
import {
  evaluateDeparture,
  evaluateStay,
  hotelQuote,
  tourQuote,
  type RoomWithHotel,
} from "./offer";

const UNAVAILABLE_DETAIL: Record<string, string> = {
  occupancy: "This room type does not fit the selected guests.",
  "no-inventory": "This room is not on sale for some of the selected nights.",
  "sold-out": "Sorry, it just sold out for these dates.",
  "no-rate": "This room has no price for some of the selected nights.",
  currency: "This room is not sold in the requested currency.",
  closed: "This departure is no longer on sale.",
  departed: "This departure has already left.",
};

function unavailable(reason: string): ProblemException {
  return new ProblemException(
    409,
    "not-available",
    "No longer available",
    UNAVAILABLE_DETAIL[reason] ?? "This option is no longer available.",
  );
}

function priceChanged(quote: Quote): ProblemException {
  const total = quote.price!.total;
  const taka = (total.amountMinor / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 });
  return new ProblemException(
    409,
    "price-changed",
    "Price changed",
    `The price is now ${total.currency} ${taka}. Review the new total and confirm again.`,
  );
}

export interface CreateBookingContext {
  userId: bigint;
  userPublicId: string;
  ipAddress: string | null;
}

/**
 * Creates a booking with an inventory hold, in one transaction:
 * lock rows → re-read inventory and rates → recompute the price → compare with
 * what the customer saw → increment `held` → write booking, items, guests,
 * holds, status history, outbox event and audit event.
 *
 * The booking ends in PENDING_PAYMENT with `holdExpiresAt`. It is never
 * CONFIRMED here: confirmation requires a verified payment (Phase 5).
 */
@Injectable()
export class BookingCreateService {
  private readonly logger = new Logger("BookingCreate");

  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Returns the new booking's public id. */
  async create(
    req: CreateBookingRequest,
    ctx: CreateBookingContext,
    now: Date = new Date(),
  ): Promise<string> {
    // A reference collision (1 in ~887 million) aborts the transaction; retry once.
    for (let attempt = 0; ; attempt++) {
      try {
        return req.product === "HOTEL"
          ? await this.createHotel(req, ctx, now)
          : await this.createTour(req, ctx, now);
      } catch (error) {
        const collision =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002" &&
          String(error.meta?.target ?? "").includes("reference");
        if (!collision || attempt > 0) throw error;
        this.logger.warn("Booking reference collision; retrying");
      }
    }
  }

  private holdUntil(now: Date): Date {
    return new Date(now.getTime() + this.config.BOOKING_HOLD_MINUTES * 60_000);
  }

  private async createHotel(
    req: Extract<CreateBookingRequest, { product: "HOTEL" }>,
    ctx: CreateBookingContext,
    now: Date,
  ): Promise<string> {
    const stay = parseStay(req.checkIn, req.checkOut, now);
    const room: RoomWithHotel | null = await this.db.hotelRoom.findFirst({
      where: {
        publicId: req.roomId,
        isActive: true,
        hotel: { status: "PUBLISHED", destination: { status: "PUBLISHED" } },
      },
      include: { hotel: true },
    });
    if (!room) throw new ProblemException(404, "room-not-found", "Room not found");
    const params = {
      checkIn: stay.checkIn,
      checkOut: stay.checkOut,
      rooms: req.rooms,
      adults: req.adults,
      children: req.children,
    };

    return this.db.$transaction(
      async (tx) => {
        await lockRoomNights(tx, room.id, stay.checkIn, stay.checkOut);
        const result = await evaluateStay(tx, room, params);
        if (!result.ok) throw unavailable(result.reason);
        const quote = hotelQuote(room, params, result, now);
        this.assertSamePrice(quote, req.expectedTotal);

        const updated = await tx.roomInventory.updateMany({
          where: { roomId: room.id, stayDate: { gte: stay.checkIn, lt: stay.checkOut } },
          data: { held: { increment: req.rooms } },
        });
        if (updated.count !== stay.nights) throw unavailable("no-inventory");

        const holdExpiresAt = this.holdUntil(now);
        const p = result.price;
        const { bookingId, publicId } = await this.insertBooking(tx, {
          ctx,
          productType: "HOTEL",
          productName: room.hotel.name,
          startDate: stay.checkIn,
          endDate: stay.checkOut,
          currency: room.hotel.currency,
          baseMinor: p.baseMinor,
          serviceChargeMinor: p.serviceChargeMinor,
          vatMinor: p.vatMinor,
          totalMinor: p.totalMinor,
          contact: req.contact,
          guests: req.guests,
          holdExpiresAt,
        });
        const item = await tx.bookingItem.create({
          data: {
            bookingId,
            itemType: "HOTEL_ROOM",
            hotelRoomId: room.id,
            description: `${room.name} × ${req.rooms}, ${stay.nights} night${stay.nights > 1 ? "s" : ""}`,
            quantity: req.rooms,
            amountMinor: p.totalMinor,
            currency: room.hotel.currency,
            priceSnapshot: {
              nights: stayNights(stay.checkIn, stay.checkOut).map(formatCalendarDate),
              baseMinor: p.baseMinor.toString(),
              serviceChargeBps: room.hotel.serviceChargeBps,
              vatBps: room.hotel.vatBps,
              totalMinor: p.totalMinor.toString(),
            },
          },
          select: { id: true },
        });
        await tx.inventoryHold.createMany({
          data: stayNights(stay.checkIn, stay.checkOut).map((stayDate) => ({
            bookingId,
            bookingItemId: item.id,
            hotelRoomId: room.id,
            stayDate,
            quantity: req.rooms,
            expiresAt: holdExpiresAt,
          })),
        });
        await this.afterInsert(tx, { bookingId, publicId, ctx, holdExpiresAt, total: quote });
        return publicId;
      },
      { timeout: 15_000, maxWait: 5_000 },
    );
  }

  private async createTour(
    req: Extract<CreateBookingRequest, { product: "TOUR" }>,
    ctx: CreateBookingContext,
    now: Date,
  ): Promise<string> {
    const found = await this.db.tourSchedule.findFirst({
      where: {
        publicId: req.departureId,
        tour: { status: "PUBLISHED", destination: { status: "PUBLISHED" } },
      },
      select: { id: true },
    });
    if (!found) throw new ProblemException(404, "departure-not-found", "Departure not found");

    return this.db.$transaction(
      async (tx) => {
        await lockTourSchedule(tx, found.id);
        const s = await tx.tourSchedule.findUniqueOrThrow({
          where: { id: found.id },
          include: { tour: true },
        });
        const result = evaluateDeparture(s, req.adults, req.children, now);
        if (!result.ok) throw unavailable(result.reason);
        const quote = tourQuote(s, req.adults, req.children, result, now);
        this.assertSamePrice(quote, req.expectedTotal);

        const party = req.adults + req.children;
        await tx.tourSchedule.update({
          where: { id: s.id },
          data: { held: { increment: party } },
        });

        const holdExpiresAt = this.holdUntil(now);
        const p = result.price;
        const { bookingId, publicId } = await this.insertBooking(tx, {
          ctx,
          productType: "TOUR",
          productName: s.tour.title,
          startDate: dhakaToday(s.departsAt),
          endDate: dhakaToday(s.returnsAt),
          currency: s.currency,
          baseMinor: p.baseMinor,
          serviceChargeMinor: 0n,
          vatMinor: p.vatMinor,
          totalMinor: p.totalMinor,
          contact: req.contact,
          guests: req.guests,
          holdExpiresAt,
        });
        const item = await tx.bookingItem.create({
          data: {
            bookingId,
            itemType: "TOUR_SEAT",
            tourScheduleId: s.id,
            description: `${req.adults} adult${req.adults > 1 ? "s" : ""}${
              req.children ? `, ${req.children} child${req.children > 1 ? "ren" : ""}` : ""
            } · ${quote.optionName}`,
            quantity: party,
            amountMinor: p.totalMinor,
            currency: s.currency,
            priceSnapshot: {
              priceAdultMinor: s.priceAdultMinor.toString(),
              priceChildMinor: s.priceChildMinor.toString(),
              adults: req.adults,
              children: req.children,
              vatBps: s.tour.vatBps,
              totalMinor: p.totalMinor.toString(),
            },
          },
          select: { id: true },
        });
        await tx.inventoryHold.create({
          data: {
            bookingId,
            bookingItemId: item.id,
            tourScheduleId: s.id,
            quantity: party,
            expiresAt: holdExpiresAt,
          },
        });
        await this.afterInsert(tx, { bookingId, publicId, ctx, holdExpiresAt, total: quote });
        return publicId;
      },
      { timeout: 15_000, maxWait: 5_000 },
    );
  }

  private assertSamePrice(quote: Quote, expected: { amountMinor: number; currency: string }) {
    const total = quote.price!.total;
    if (total.amountMinor !== expected.amountMinor || total.currency !== expected.currency) {
      throw priceChanged(quote);
    }
  }

  private async insertBooking(
    tx: Tx,
    b: {
      ctx: CreateBookingContext;
      productType: "HOTEL" | "TOUR";
      productName: string;
      startDate: Date;
      endDate: Date;
      currency: string;
      baseMinor: bigint;
      serviceChargeMinor: bigint;
      vatMinor: bigint;
      totalMinor: bigint;
      contact: BookingContact;
      guests: GuestInput[];
      holdExpiresAt: Date;
    },
  ): Promise<{ bookingId: bigint; publicId: string }> {
    // Created as PENDING_AVAILABILITY and moved to PENDING_PAYMENT once the
    // hold is written. Both edges go through the state machine's rules.
    assertTransition("PENDING_AVAILABILITY", "PENDING_PAYMENT", "SYSTEM");
    const publicId = newPublicId();
    const booking = await tx.booking.create({
      data: {
        publicId,
        reference: newBookingReference(),
        userId: b.ctx.userId,
        status: "PENDING_PAYMENT",
        productType: b.productType,
        productName: b.productName.slice(0, 160),
        startDate: b.startDate,
        endDate: b.endDate,
        guestCount: b.guests.length,
        currency: b.currency,
        baseMinor: b.baseMinor,
        serviceChargeMinor: b.serviceChargeMinor,
        vatMinor: b.vatMinor,
        totalMinor: b.totalMinor,
        contactName: b.contact.name,
        contactEmail: b.contact.email,
        contactPhone: b.contact.phone,
        holdExpiresAt: b.holdExpiresAt,
        guests: {
          create: b.guests.map((g, i) => ({
            fullName: g.fullName,
            ageGroup: g.ageGroup,
            isLead: i === 0,
          })),
        },
      },
      select: { id: true },
    });
    return { bookingId: booking.id, publicId };
  }

  private async afterInsert(
    tx: Tx,
    a: {
      bookingId: bigint;
      publicId: string;
      ctx: CreateBookingContext;
      holdExpiresAt: Date;
      total: Quote;
    },
  ): Promise<void> {
    await tx.bookingStatusHistory.createMany({
      data: [
        {
          bookingId: a.bookingId,
          fromStatus: null,
          toStatus: "PENDING_AVAILABILITY",
          actorType: "CUSTOMER",
          actorUserId: a.ctx.userId,
          reason: "Booking requested",
        },
        {
          bookingId: a.bookingId,
          fromStatus: "PENDING_AVAILABILITY",
          toStatus: "PENDING_PAYMENT",
          actorType: "SYSTEM",
          actorUserId: null,
          reason: `Inventory held until ${a.holdExpiresAt.toISOString()}`,
        },
      ],
    });
    // Consumed by the worker (Phase 5: confirmation email, payment reminders).
    await tx.outboxEvent.create({
      data: {
        eventType: "booking.held",
        aggregateType: "booking",
        aggregateId: a.publicId,
        payload: {
          bookingId: a.publicId,
          holdExpiresAt: a.holdExpiresAt.toISOString(),
          total: a.total.price!.total,
        },
      },
    });
    await this.audit.record(
      {
        actorType: "CUSTOMER",
        actorUserId: a.ctx.userId,
        action: "booking.created",
        targetType: "booking",
        targetId: a.publicId,
        ipAddress: a.ctx.ipAddress,
        metadata: { product: a.total.product, total: a.total.price!.total },
      },
      tx,
    );
  }
}
