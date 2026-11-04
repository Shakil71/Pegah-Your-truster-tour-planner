import { describe, expect, it } from "vitest";
import { parseCalendarDate, stayNights } from "../common/time";
import { evaluateRoom, type RoomCandidate, type StayRequest } from "./hotel-search";

const nights = stayNights(parseCalendarDate("2026-12-10"), parseCalendarDate("2026-12-13"));

function room(overrides: Partial<RoomCandidate> = {}): RoomCandidate {
  return {
    maxAdults: 2,
    maxChildren: 1,
    inventory: nights.map((d) => ({ stayDate: d, total: 5, held: 1, sold: 1 })),
    rates: nights.map((d) => ({ stayDate: d, amountMinor: 650_000n, currency: "BDT" })),
    ...overrides,
  };
}

const request: StayRequest = {
  nights,
  rooms: 1,
  adults: 2,
  children: 0,
  currency: "BDT",
  serviceChargeBps: 1000,
  vatBps: 1500,
};

describe("evaluateRoom", () => {
  it("prices an available room over every night", () => {
    const r = evaluateRoom(room(), request);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.roomsLeft).toBe(3);
    expect(r.price.nights).toBe(3);
    expect(r.price.baseMinor).toBe(1_950_000n);
    expect(r.price.totalMinor).toBe(
      r.price.baseMinor + r.price.serviceChargeMinor + r.price.vatMinor,
    );
  });

  it("reports the tightest night as rooms left", () => {
    const inv = nights.map((d, i) => ({ stayDate: d, total: 5, held: 0, sold: i === 1 ? 4 : 0 }));
    const r = evaluateRoom(room({ inventory: inv }), request);
    expect(r.ok && r.roomsLeft).toBe(1);
  });

  it("is sold out if any single night lacks enough rooms", () => {
    const inv = nights.map((d, i) => ({ stayDate: d, total: 2, held: 1, sold: i === 2 ? 1 : 0 }));
    expect(evaluateRoom(room({ inventory: inv }), request)).toEqual({
      ok: false,
      reason: "sold-out",
    });
  });

  it("needs inventory and a rate for every night", () => {
    expect(evaluateRoom(room({ inventory: room().inventory.slice(1) }), request)).toEqual({
      ok: false,
      reason: "no-inventory",
    });
    expect(evaluateRoom(room({ rates: room().rates.slice(0, 2) }), request)).toEqual({
      ok: false,
      reason: "no-rate",
    });
  });

  it("enforces occupancy per room", () => {
    expect(evaluateRoom(room(), { ...request, adults: 3 })).toEqual({
      ok: false,
      reason: "occupancy",
    });
    expect(evaluateRoom(room(), { ...request, adults: 3, rooms: 2 }).ok).toBe(true);
    expect(evaluateRoom(room(), { ...request, children: 2 })).toEqual({
      ok: false,
      reason: "occupancy",
    });
    // Every room needs at least one adult.
    expect(evaluateRoom(room(), { ...request, adults: 1, rooms: 2 })).toEqual({
      ok: false,
      reason: "occupancy",
    });
  });

  it("refuses to mix currencies", () => {
    const rates = nights.map((d) => ({ stayDate: d, amountMinor: 5_000n, currency: "USD" }));
    expect(evaluateRoom(room({ rates }), request)).toEqual({ ok: false, reason: "currency" });
  });
});
