import { describe, expect, it } from "vitest";
import { formatMoney, taka, takaCompact } from "./money";

describe("formatMoney", () => {
  it("formats BDT with South Asian grouping", () => {
    expect(formatMoney({ amountMinor: 12450000, currency: "BDT" })).toBe("৳ 1,24,500");
  });

  it("shows paisa when decimals are requested", () => {
    expect(formatMoney({ amountMinor: 1234505, currency: "BDT" }, { decimals: true })).toBe(
      "৳ 12,345.05",
    );
  });

  it("formats USD with Western grouping", () => {
    expect(formatMoney({ amountMinor: 12450000, currency: "USD" })).toBe("$ 124,500");
  });

  it("rejects fractional minor units", () => {
    expect(() => formatMoney({ amountMinor: 10.5, currency: "BDT" })).toThrow(TypeError);
  });
});

describe("taka helpers", () => {
  it("formats whole taka", () => {
    expect(taka(14500)).toBe("৳ 14,500");
  });

  it("compacts lakh and crore", () => {
    expect(takaCompact(840000)).toBe("৳ 8.4L");
    expect(takaCompact(12000000)).toBe("৳ 1.2Cr");
    expect(takaCompact(52000)).toBe("৳ 52K");
    expect(takaCompact(900)).toBe("৳ 900");
  });
});
