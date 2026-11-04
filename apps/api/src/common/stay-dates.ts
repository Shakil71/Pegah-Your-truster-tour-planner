import { ProblemException } from "./problem";
import { addDays, dhakaToday, nightsBetween, parseCalendarDate } from "./time";

export const MAX_NIGHTS = 30;
export const MAX_DAYS_AHEAD = 365;

/**
 * Parses and validates a stay: check-in today or later (Dhaka calendar), at
 * most a year ahead, 1–30 nights. Shared by search, quotes and booking.
 */
export function parseStay(
  checkInRaw: string,
  checkOutRaw: string,
  now: Date,
): { checkIn: Date; checkOut: Date; nights: number } {
  let checkIn: Date;
  let checkOut: Date;
  try {
    checkIn = parseCalendarDate(checkInRaw);
    checkOut = parseCalendarDate(checkOutRaw);
  } catch {
    throw new ProblemException(400, "invalid-dates", "Invalid dates", "Use real calendar dates.");
  }
  const today = dhakaToday(now);
  const nights = nightsBetween(checkIn, checkOut);
  if (checkIn < today) {
    throw new ProblemException(
      400,
      "invalid-dates",
      "Invalid dates",
      "Check-in cannot be in the past.",
    );
  }
  if (checkIn > addDays(today, MAX_DAYS_AHEAD)) {
    throw new ProblemException(400, "invalid-dates", "Invalid dates", "Check-in is too far ahead.");
  }
  if (nights < 1 || nights > MAX_NIGHTS) {
    throw new ProblemException(
      400,
      "invalid-dates",
      "Invalid dates",
      `Stays must be between 1 and ${MAX_NIGHTS} nights.`,
    );
  }
  return { checkIn, checkOut, nights };
}
