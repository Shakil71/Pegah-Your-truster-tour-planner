/**
 * Calendar-date helpers. Stay dates are plain calendar dates in the Asia/Dhaka
 * calendar, stored in MySQL DATE columns and handled here as UTC-midnight
 * Date objects so no host time zone can shift them.
 */

export const DHAKA_TZ = "Asia/Dhaka";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parses YYYY-MM-DD into a UTC-midnight Date, rejecting impossible dates. */
export function parseCalendarDate(value: string): Date {
  const m = ISO_DATE.exec(value);
  if (!m) throw new RangeError(`Invalid calendar date: ${value}`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) {
    throw new RangeError(`Invalid calendar date: ${value}`);
  }
  return date;
}

export function formatCalendarDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Today's date in Dhaka, as a UTC-midnight Date. */
export function dhakaToday(now: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DHAKA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parseCalendarDate(parts);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

/** Whole nights between two UTC-midnight dates. */
export function nightsBetween(checkIn: Date, checkOut: Date): number {
  return Math.round((checkOut.getTime() - checkIn.getTime()) / 86_400_000);
}

/** Each night of a stay: [checkIn, checkOut). */
export function stayNights(checkIn: Date, checkOut: Date): Date[] {
  const n = nightsBetween(checkIn, checkOut);
  return Array.from({ length: Math.max(0, n) }, (_, i) => addDays(checkIn, i));
}
