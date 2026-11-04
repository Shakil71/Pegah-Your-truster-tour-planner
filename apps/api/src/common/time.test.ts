import { describe, expect, it } from "vitest";
import {
  dhakaToday,
  formatCalendarDate,
  nightsBetween,
  parseCalendarDate,
  stayNights,
} from "./time";

describe("calendar dates", () => {
  it("round-trips YYYY-MM-DD as UTC midnight", () => {
    const d = parseCalendarDate("2026-11-04");
    expect(d.toISOString()).toBe("2026-11-04T00:00:00.000Z");
    expect(formatCalendarDate(d)).toBe("2026-11-04");
  });

  it("rejects impossible or malformed dates", () => {
    expect(() => parseCalendarDate("2026-02-30")).toThrow(RangeError);
    expect(() => parseCalendarDate("2026-13-01")).toThrow(RangeError);
    expect(() => parseCalendarDate("4/11/2026")).toThrow(RangeError);
  });

  it("uses the Dhaka calendar for today (UTC+6)", () => {
    // 2026-11-04 18:30 UTC is already 00:30 on the 5th in Dhaka.
    expect(formatCalendarDate(dhakaToday(new Date("2026-11-04T18:30:00Z")))).toBe("2026-11-05");
    expect(formatCalendarDate(dhakaToday(new Date("2026-11-04T17:59:59Z")))).toBe("2026-11-04");
  });

  it("lists each night of a stay, excluding check-out", () => {
    const nights = stayNights(parseCalendarDate("2026-12-30"), parseCalendarDate("2027-01-02"));
    expect(nights.map(formatCalendarDate)).toEqual(["2026-12-30", "2026-12-31", "2027-01-01"]);
    expect(nightsBetween(parseCalendarDate("2026-12-30"), parseCalendarDate("2027-01-02"))).toBe(3);
  });
});
