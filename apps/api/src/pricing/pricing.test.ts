import { describe, expect, it } from "vitest";
import { applyBps, priceStay, priceTour } from "./pricing";

describe("applyBps", () => {
  it("computes basis points on minor units", () => {
    expect(applyBps(1_000_000n, 1000)).toBe(100_000n); // 10% of ৳10,000
    expect(applyBps(1_000_000n, 1500)).toBe(150_000n); // 15%
    expect(applyBps(0n, 1500)).toBe(0n);
  });

  it("rounds half up to the nearest paisa", () => {
    expect(applyBps(5n, 1000)).toBe(1n); // 0.5 → 1
    expect(applyBps(4n, 1000)).toBe(0n); // 0.4 → 0
    expect(applyBps(15n, 1000)).toBe(2n); // 1.5 → 2
    expect(applyBps(333_333n, 1500)).toBe(50_000n); // 49 999.95 → 50 000
  });

  it("rejects negative amounts and invalid rates", () => {
    expect(() => applyBps(-1n, 100)).toThrow(RangeError);
    expect(() => applyBps(1n, -1)).toThrow(RangeError);
    expect(() => applyBps(1n, 1.5)).toThrow(RangeError);
  });

  it("stays exact beyond float precision", () => {
    const big = 9_007_199_254_740_993n; // 2^53 + 1, not representable as a double
    expect(applyBps(big, 10_000)).toBe(big);
  });
});

describe("priceStay", () => {
  it("adds service charge on base and VAT on base + service charge", () => {
    // 2 nights × ৳8,500 × 2 rooms = ৳34,000; 10% SC = ৳3,400; 15% VAT on ৳37,400 = ৳5,610
    const p = priceStay({
      nightlyRatesMinor: [850_000n, 850_000n],
      rooms: 2,
      serviceChargeBps: 1000,
      vatBps: 1500,
    });
    expect(p).toEqual({
      nights: 2,
      rooms: 2,
      baseMinor: 3_400_000n,
      serviceChargeMinor: 340_000n,
      vatMinor: 561_000n,
      totalMinor: 4_301_000n,
      perNightFromMinor: 850_000n,
    });
  });

  it("handles varying nightly rates and reports the lowest", () => {
    const p = priceStay({
      nightlyRatesMinor: [900_000n, 1_200_000n, 750_000n],
      rooms: 1,
      serviceChargeBps: 0,
      vatBps: 0,
    });
    expect(p.baseMinor).toBe(2_850_000n);
    expect(p.totalMinor).toBe(2_850_000n);
    expect(p.perNightFromMinor).toBe(750_000n);
  });

  it("always satisfies total = base + service charge + VAT", () => {
    for (const rate of [1n, 99n, 123_457n, 999_999n]) {
      const p = priceStay({
        nightlyRatesMinor: [rate],
        rooms: 3,
        serviceChargeBps: 1000,
        vatBps: 1500,
      });
      expect(p.totalMinor).toBe(p.baseMinor + p.serviceChargeMinor + p.vatMinor);
    }
  });

  it("rejects empty stays, bad room counts and negative rates", () => {
    const ok = { serviceChargeBps: 0, vatBps: 0 };
    expect(() => priceStay({ nightlyRatesMinor: [], rooms: 1, ...ok })).toThrow(RangeError);
    expect(() => priceStay({ nightlyRatesMinor: [1n], rooms: 0, ...ok })).toThrow(RangeError);
    expect(() => priceStay({ nightlyRatesMinor: [-1n], rooms: 1, ...ok })).toThrow(RangeError);
  });
});

describe("priceTour", () => {
  it("prices adults and children separately, then VAT", () => {
    const p = priceTour({
      adults: 2,
      children: 1,
      priceAdultMinor: 1_850_000n,
      priceChildMinor: 1_200_000n,
      vatBps: 500,
    });
    expect(p).toEqual({ baseMinor: 4_900_000n, vatMinor: 245_000n, totalMinor: 5_145_000n });
  });

  it("requires at least one adult", () => {
    expect(() =>
      priceTour({ adults: 0, children: 2, priceAdultMinor: 1n, priceChildMinor: 1n, vatBps: 0 }),
    ).toThrow(RangeError);
  });
});
