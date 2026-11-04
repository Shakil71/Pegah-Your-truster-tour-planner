import type { BookingSummary } from "@pegah/contracts";
import type { Booking } from "@pegah/db";
import { toMoney } from "../common/money";
import { formatCalendarDate } from "../common/time";

export function toBookingSummary(b: Booking): BookingSummary {
  return {
    id: b.publicId,
    reference: b.reference,
    status: b.status,
    productType: b.productType,
    productName: b.productName,
    startDate: formatCalendarDate(b.startDate),
    endDate: b.endDate ? formatCalendarDate(b.endDate) : null,
    guests: b.guestCount,
    total: toMoney(b.totalMinor, b.currency),
    contactName: b.contactName,
    createdAt: b.createdAt.toISOString(),
  };
}

/** Opaque keyset cursor over the internal id (newest first). */
export function encodeCursor(id: bigint): string {
  return Buffer.from(id.toString()).toString("base64url");
}

export function decodeCursor(cursor: string | undefined): bigint | undefined {
  if (!cursor) return undefined;
  const raw = Buffer.from(cursor, "base64url").toString();
  return /^\d{1,20}$/.test(raw) ? BigInt(raw) : undefined;
}
