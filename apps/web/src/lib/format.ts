import { formatMoney, type Money } from "@pegah/shared";

/** Money for display: paisa shown only when the amount is not whole taka. */
export function money(m: Money): string {
  return formatMoney(m, { decimals: m.amountMinor % 100 !== 0 });
}

const DATE = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
  year: "numeric",
});
const DATE_TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Dhaka",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** A calendar date (YYYY-MM-DD) as "12 Nov 2026". */
export function calendarDate(iso: string): string {
  return DATE.format(new Date(`${iso}T00:00:00Z`));
}

/** An instant in Dhaka time, "12 Nov, 14:05". */
export function dhakaDateTime(iso: string): string {
  return DATE_TIME.format(new Date(iso));
}

export function timeAgo(iso: string, now = Date.now()): string {
  const min = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  return h < 24 ? `${h} h ago` : `${Math.floor(h / 24)} d ago`;
}
