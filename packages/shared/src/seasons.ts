/**
 * Bangladesh's six seasons (ritu). Each spans two Bangla months, which begin
 * mid-month in the Gregorian calendar; Grishma starts on 14–15 April.
 * We use the 15th as the boundary for display purposes.
 */
export type RituKey = "grishma" | "barsha" | "sharat" | "hemanta" | "sheet" | "basanta";

export type Ritu = {
  key: RituKey;
  bn: string;
  en: string;
  months: string;
};

export const RITUS: readonly Ritu[] = [
  { key: "grishma", bn: "গ্রীষ্ম", en: "Grishma", months: "mid-Apr – mid-Jun" },
  { key: "barsha", bn: "বর্ষা", en: "Barsha", months: "mid-Jun – mid-Aug" },
  { key: "sharat", bn: "শরৎ", en: "Sharat", months: "mid-Aug – mid-Oct" },
  { key: "hemanta", bn: "হেমন্ত", en: "Hemanta", months: "mid-Oct – mid-Dec" },
  { key: "sheet", bn: "শীত", en: "Sheet", months: "mid-Dec – mid-Feb" },
  { key: "basanta", bn: "বসন্ত", en: "Basanta", months: "mid-Feb – mid-Apr" },
];

/**
 * Index into RITUS for a calendar date (month 0–11, day 1–31).
 * Each ritu covers four half-months; Grishma begins at half-month 7 (15 Apr).
 */
export function rituIndex(month: number, day: number): number {
  if (month < 0 || month > 11 || day < 1 || day > 31) {
    throw new RangeError("month must be 0–11 and day 1–31");
  }
  const half = month * 2 + (day >= 15 ? 1 : 0);
  return Math.floor(((half - 7 + 24) % 24) / 4);
}

/**
 * Today's calendar date in Asia/Dhaka (month 0–11), regardless of the
 * server's or browser's time zone, so SSR and hydration agree.
 */
export function dhakaDate(now: Date = new Date()): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { year: get("year"), month: get("month") - 1, day: get("day") };
}

/** Current ritu in Asia/Dhaka. */
export function currentRitu(now: Date = new Date()): Ritu {
  const { month, day } = dhakaDate(now);
  return RITUS[rituIndex(month, day)] as Ritu;
}
