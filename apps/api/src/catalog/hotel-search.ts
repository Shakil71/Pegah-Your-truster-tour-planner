import { priceStay, type StayPriceBreakdown } from "../pricing/pricing";

/**
 * Pure availability-and-price evaluation for one room type over a stay.
 * Kept free of Prisma so the rules are unit-tested directly.
 */

export interface NightInventory {
  stayDate: Date;
  total: number;
  held: number;
  sold: number;
}

export interface NightRate {
  stayDate: Date;
  amountMinor: bigint;
  currency: string;
}

export interface RoomCandidate {
  maxAdults: number;
  maxChildren: number;
  inventory: readonly NightInventory[];
  rates: readonly NightRate[];
}

export interface StayRequest {
  nights: readonly Date[];
  rooms: number;
  adults: number;
  children: number;
  currency: string;
  serviceChargeBps: number;
  vatBps: number;
}

export type RoomEvaluation =
  | { ok: true; roomsLeft: number; price: StayPriceBreakdown }
  | { ok: false; reason: "occupancy" | "no-inventory" | "sold-out" | "no-rate" | "currency" };

export function evaluateRoom(room: RoomCandidate, req: StayRequest): RoomEvaluation {
  // Every room needs an adult; guests must fit the room type's limits.
  if (req.adults < req.rooms) return { ok: false, reason: "occupancy" };
  if (req.adults > room.maxAdults * req.rooms) return { ok: false, reason: "occupancy" };
  if (req.children > room.maxChildren * req.rooms) return { ok: false, reason: "occupancy" };

  const invByDate = new Map(room.inventory.map((i) => [i.stayDate.getTime(), i]));
  const rateByDate = new Map(room.rates.map((r) => [r.stayDate.getTime(), r]));

  let roomsLeft = Number.POSITIVE_INFINITY;
  const nightly: bigint[] = [];
  for (const night of req.nights) {
    const inv = invByDate.get(night.getTime());
    if (!inv) return { ok: false, reason: "no-inventory" };
    const free = inv.total - inv.held - inv.sold;
    if (free < req.rooms) return { ok: false, reason: "sold-out" };
    roomsLeft = Math.min(roomsLeft, free);

    const rate = rateByDate.get(night.getTime());
    if (!rate) return { ok: false, reason: "no-rate" };
    if (rate.currency !== req.currency) return { ok: false, reason: "currency" };
    nightly.push(rate.amountMinor);
  }

  return {
    ok: true,
    roomsLeft,
    price: priceStay({
      nightlyRatesMinor: nightly,
      rooms: req.rooms,
      serviceChargeBps: req.serviceChargeBps,
      vatBps: req.vatBps,
    }),
  };
}
