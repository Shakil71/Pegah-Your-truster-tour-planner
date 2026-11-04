/**
 * Pricing engine. Pure functions over BIGINT minor units (paisa): no floats,
 * no I/O. The server is the only place totals are computed; clients display
 * what these functions return.
 */

const BPS_DENOMINATOR = 10_000n;

/** amount × bps / 10 000, rounded half-up to the nearest minor unit. */
export function applyBps(amountMinor: bigint, bps: number): bigint {
  if (amountMinor < 0n) throw new RangeError("Amount must not be negative");
  if (!Number.isInteger(bps) || bps < 0 || bps > 100_000) {
    throw new RangeError("Basis points must be an integer between 0 and 100000");
  }
  const scaled = amountMinor * BigInt(bps);
  return (scaled + BPS_DENOMINATOR / 2n) / BPS_DENOMINATOR;
}

export interface StayPriceInput {
  /** Rate for one room for each night of the stay, in order. */
  nightlyRatesMinor: readonly bigint[];
  rooms: number;
  /** Service charge on the room base (Bangladeshi hotels commonly use 10%). */
  serviceChargeBps: number;
  /** VAT, applied on base + service charge. */
  vatBps: number;
}

export interface StayPriceBreakdown {
  nights: number;
  rooms: number;
  baseMinor: bigint;
  serviceChargeMinor: bigint;
  vatMinor: bigint;
  totalMinor: bigint;
  /** Lowest single-room nightly rate in the stay (for "from" display). */
  perNightFromMinor: bigint;
}

export function priceStay(input: StayPriceInput): StayPriceBreakdown {
  const { nightlyRatesMinor, rooms } = input;
  if (nightlyRatesMinor.length === 0) throw new RangeError("A stay needs at least one night");
  if (!Number.isInteger(rooms) || rooms < 1)
    throw new RangeError("Rooms must be a positive integer");
  let perRoom = 0n;
  let lowest = nightlyRatesMinor[0]!;
  for (const rate of nightlyRatesMinor) {
    if (rate < 0n) throw new RangeError("Rates must not be negative");
    perRoom += rate;
    if (rate < lowest) lowest = rate;
  }
  const baseMinor = perRoom * BigInt(rooms);
  const serviceChargeMinor = applyBps(baseMinor, input.serviceChargeBps);
  const vatMinor = applyBps(baseMinor + serviceChargeMinor, input.vatBps);
  return {
    nights: nightlyRatesMinor.length,
    rooms,
    baseMinor,
    serviceChargeMinor,
    vatMinor,
    totalMinor: baseMinor + serviceChargeMinor + vatMinor,
    perNightFromMinor: lowest,
  };
}

export interface TourPriceInput {
  adults: number;
  children: number;
  priceAdultMinor: bigint;
  priceChildMinor: bigint;
  vatBps: number;
}

export interface TourPriceBreakdown {
  baseMinor: bigint;
  vatMinor: bigint;
  totalMinor: bigint;
}

export function priceTour(input: TourPriceInput): TourPriceBreakdown {
  const { adults, children } = input;
  if (!Number.isInteger(adults) || adults < 1)
    throw new RangeError("At least one adult is required");
  if (!Number.isInteger(children) || children < 0)
    throw new RangeError("Children must be zero or more");
  if (input.priceAdultMinor < 0n || input.priceChildMinor < 0n) {
    throw new RangeError("Prices must not be negative");
  }
  const baseMinor =
    input.priceAdultMinor * BigInt(adults) + input.priceChildMinor * BigInt(children);
  const vatMinor = applyBps(baseMinor, input.vatBps);
  return { baseMinor, vatMinor, totalMinor: baseMinor + vatMinor };
}
