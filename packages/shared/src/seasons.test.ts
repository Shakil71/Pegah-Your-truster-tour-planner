import { describe, expect, it } from "vitest";
import { RITUS, currentRitu, dhakaDate, rituIndex } from "./seasons";

describe("dhakaDate", () => {
  it("rolls over at Dhaka midnight (UTC+6)", () => {
    expect(dhakaDate(new Date("2026-11-04T17:59:00Z"))).toEqual({ year: 2026, month: 10, day: 4 });
    expect(dhakaDate(new Date("2026-11-04T18:00:00Z"))).toEqual({ year: 2026, month: 10, day: 5 });
  });
});

const en = (m: number, d: number) => RITUS[rituIndex(m, d)]?.en;

describe("rituIndex", () => {
  it.each([
    [3, 14, "Basanta"],
    [3, 15, "Grishma"],
    [5, 20, "Barsha"],
    [7, 15, "Sharat"],
    [10, 4, "Hemanta"],
    [11, 20, "Sheet"],
    [0, 10, "Sheet"],
    [1, 20, "Basanta"],
  ])("month %i day %i is %s", (m, d, expected) => {
    expect(en(m, d)).toBe(expected);
  });

  it("rejects impossible dates", () => {
    expect(() => rituIndex(12, 1)).toThrow(RangeError);
    expect(() => rituIndex(0, 0)).toThrow(RangeError);
  });
});

describe("currentRitu", () => {
  it("uses Asia/Dhaka, not UTC", () => {
    // 14 Apr 20:00 UTC is already 15 Apr 02:00 in Dhaka → Grishma.
    expect(currentRitu(new Date("2026-04-14T20:00:00Z")).en).toBe("Grishma");
  });
});
