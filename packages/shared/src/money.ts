/**
 * Money is carried as integer minor units plus an ISO 4217 currency
 * (ADR-0004). These helpers only format; they never do pricing arithmetic.
 */
export type Money = {
  amountMinor: number;
  currency: "BDT" | "USD";
};

const SYMBOL: Record<Money["currency"], string> = { BDT: "৳", USD: "$" };

/** Formats with South Asian digit grouping for BDT, e.g. ৳ 1,24,500. */
export function formatMoney(money: Money, opts: { decimals?: boolean } = {}): string {
  if (!Number.isInteger(money.amountMinor)) {
    throw new TypeError("amountMinor must be an integer number of minor units");
  }
  const major = money.amountMinor / 100;
  const locale = money.currency === "BDT" ? "en-IN" : "en-US";
  const text = major.toLocaleString(locale, {
    minimumFractionDigits: opts.decimals ? 2 : 0,
    maximumFractionDigits: opts.decimals ? 2 : 0,
  });
  return `${SYMBOL[money.currency]} ${text}`;
}

/** Shorthand for whole-taka sample prices. */
export function taka(wholeTaka: number): string {
  return formatMoney({ amountMinor: Math.round(wholeTaka * 100), currency: "BDT" });
}

/** Compact taka for dashboards: ৳ 8.4L, ৳ 1.2Cr. */
export function takaCompact(wholeTaka: number): string {
  const abs = Math.abs(wholeTaka);
  const sign = wholeTaka < 0 ? "−" : "";
  if (abs >= 1e7) return `${sign}৳ ${(abs / 1e7).toFixed(abs >= 1e8 ? 0 : 1)}Cr`;
  if (abs >= 1e5) return `${sign}৳ ${(abs / 1e5).toFixed(abs >= 1e6 ? 0 : 1)}L`;
  if (abs >= 1e3) return `${sign}৳ ${(abs / 1e3).toFixed(abs >= 1e4 ? 0 : 1)}K`;
  return `${sign}৳ ${abs}`;
}
