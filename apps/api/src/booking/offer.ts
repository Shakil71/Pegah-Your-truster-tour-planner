import type { PriceBreakdown, Quote } from "@pegah/contracts";
import type { Prisma } from "@pegah/db";
import { evaluateRoom, type RoomEvaluation } from "../catalog/hotel-search";
import { toMoney } from "../common/money";
import { dhakaToday, formatCalendarDate, stayNights } from "../common/time";
import { priceTour, type TourPriceBreakdown } from "../pricing/pricing";
import type { Tx } from "./inventory";

/**
 * Availability-and-price evaluation shared by quotes and booking creation.
 * Booking creation calls these inside its transaction, after locking the
 * rows, so the price it commits is computed from the rows it holds.
 */

export type RoomWithHotel = Prisma.HotelRoomGetPayload<{ include: { hotel: true } }>;
export type ScheduleWithTour = Prisma.TourScheduleGetPayload<{ include: { tour: true } }>;

export interface StayParams {
  checkIn: Date;
  checkOut: Date;
  rooms: number;
  adults: number;
  children: number;
}

type Reader = Pick<Tx, "roomInventory" | "roomRate">;

export async function evaluateStay(
  client: Reader,
  room: RoomWithHotel,
  p: StayParams,
): Promise<RoomEvaluation> {
  const range = { gte: p.checkIn, lt: p.checkOut };
  // Sequential on purpose: inside a transaction there is one connection.
  const inventory = await client.roomInventory.findMany({
    where: { roomId: room.id, stayDate: range },
  });
  const rates = await client.roomRate.findMany({ where: { roomId: room.id, stayDate: range } });
  return evaluateRoom(
    { maxAdults: room.maxAdults, maxChildren: room.maxChildren, inventory, rates },
    {
      nights: stayNights(p.checkIn, p.checkOut),
      rooms: p.rooms,
      adults: p.adults,
      children: p.children,
      currency: room.hotel.currency,
      serviceChargeBps: room.hotel.serviceChargeBps,
      vatBps: room.hotel.vatBps,
    },
  );
}

export type DepartureEvaluation =
  | { ok: true; seatsLeft: number; price: TourPriceBreakdown }
  | { ok: false; reason: "closed" | "departed" | "sold-out"; seatsLeft: number };

export function evaluateDeparture(
  s: ScheduleWithTour,
  adults: number,
  children: number,
  now: Date,
): DepartureEvaluation {
  const seatsLeft = Math.max(0, s.capacity - s.held - s.sold);
  if (s.status !== "SCHEDULED") return { ok: false, reason: "closed", seatsLeft };
  if (s.departsAt.getTime() <= now.getTime()) return { ok: false, reason: "departed", seatsLeft };
  if (adults + children > seatsLeft) return { ok: false, reason: "sold-out", seatsLeft };
  return {
    ok: true,
    seatsLeft,
    price: priceTour({
      adults,
      children,
      priceAdultMinor: s.priceAdultMinor,
      priceChildMinor: s.priceChildMinor,
      vatBps: s.tour.vatBps,
    }),
  };
}

export function breakdown(
  p: { baseMinor: bigint; serviceChargeMinor?: bigint; vatMinor: bigint; totalMinor: bigint },
  currency: string,
): PriceBreakdown {
  return {
    base: toMoney(p.baseMinor, currency),
    serviceCharge: toMoney(p.serviceChargeMinor ?? 0n, currency),
    vat: toMoney(p.vatMinor, currency),
    total: toMoney(p.totalMinor, currency),
  };
}

const DEPARTURE_LABEL = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Dhaka",
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** "Thu, 12 Nov 2026, 07:00" in Dhaka time. */
export function departureLabel(departsAt: Date): string {
  return DEPARTURE_LABEL.format(departsAt);
}

export function hotelQuote(
  room: RoomWithHotel,
  p: StayParams,
  result: RoomEvaluation,
  now: Date,
): Quote {
  return {
    product: "HOTEL",
    productName: room.hotel.name,
    productSlug: room.hotel.slug,
    optionName: room.name,
    startDate: formatCalendarDate(p.checkIn),
    endDate: formatCalendarDate(p.checkOut),
    nights: stayNights(p.checkIn, p.checkOut).length,
    rooms: p.rooms,
    adults: p.adults,
    children: p.children,
    available: result.ok,
    left: result.ok ? result.roomsLeft : null,
    unavailableReason: result.ok ? null : result.reason,
    price: result.ok ? breakdown(result.price, room.hotel.currency) : null,
    cancellationPolicy: room.hotel.cancellationPolicy,
    pricedAt: now.toISOString(),
  };
}

export function tourQuote(
  s: ScheduleWithTour,
  adults: number,
  children: number,
  result: DepartureEvaluation,
  now: Date,
): Quote {
  return {
    product: "TOUR",
    productName: s.tour.title,
    productSlug: s.tour.slug,
    optionName: departureLabel(s.departsAt),
    startDate: formatCalendarDate(dhakaToday(s.departsAt)),
    endDate: formatCalendarDate(dhakaToday(s.returnsAt)),
    nights: null,
    rooms: null,
    adults,
    children,
    available: result.ok,
    left: result.seatsLeft,
    unavailableReason: result.ok ? null : result.reason,
    price: result.ok ? breakdown(result.price, s.currency) : null,
    cancellationPolicy: null,
    pricedAt: now.toISOString(),
  };
}
