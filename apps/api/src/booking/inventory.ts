import type { Prisma } from "@pegah/db";
import { formatCalendarDate } from "../common/time";

/** The interactive-transaction client Prisma passes to `$transaction(fn)`. */
export type Tx = Prisma.TransactionClient;

/**
 * Inventory locking and hold release. Every function here must run inside a
 * database transaction; none of them call anything outside MySQL, so no
 * transaction is ever held open across an external request.
 *
 * Lock order is always: room_inventory rows in stay_date order, then
 * tour_schedules rows by id. Creation and release use the same order, which
 * keeps concurrent bookings from deadlocking each other.
 */

/** Locks a room type's inventory rows for [checkIn, checkOut) with SELECT … FOR UPDATE. */
export async function lockRoomNights(
  tx: Tx,
  roomId: bigint,
  checkIn: Date,
  checkOut: Date,
): Promise<void> {
  await tx.$queryRaw`
    SELECT id FROM room_inventory
    WHERE room_id = ${roomId}
      AND stay_date >= ${formatCalendarDate(checkIn)}
      AND stay_date < ${formatCalendarDate(checkOut)}
    ORDER BY stay_date
    FOR UPDATE`;
}

/** Locks one tour departure row. */
export async function lockTourSchedule(tx: Tx, scheduleId: bigint): Promise<void> {
  await tx.$queryRaw`SELECT id FROM tour_schedules WHERE id = ${scheduleId} FOR UPDATE`;
}

/**
 * Releases every ACTIVE hold of a booking: decrements `held` on the locked
 * inventory/departure rows and marks the holds RELEASED. Idempotent — a
 * second call finds no ACTIVE holds and does nothing.
 */
export async function releaseActiveHolds(tx: Tx, bookingId: bigint, now: Date): Promise<number> {
  const holds = await tx.inventoryHold.findMany({
    where: { bookingId, status: "ACTIVE" },
    orderBy: [{ stayDate: "asc" }, { id: "asc" }],
  });
  if (holds.length === 0) return 0;

  const roomHolds = holds.filter((h) => h.hotelRoomId !== null && h.stayDate !== null);
  const roomIds = [...new Set(roomHolds.map((h) => h.hotelRoomId!))].sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  for (const roomId of roomIds) {
    const dates = roomHolds.filter((h) => h.hotelRoomId === roomId).map((h) => h.stayDate!);
    const first = dates[0]!;
    const last = dates[dates.length - 1]!;
    await lockRoomNights(tx, roomId, first, new Date(last.getTime() + 86_400_000));
  }
  for (const h of roomHolds) {
    await tx.roomInventory.update({
      where: { roomId_stayDate: { roomId: h.hotelRoomId!, stayDate: h.stayDate! } },
      data: { held: { decrement: h.quantity } },
    });
  }

  const tourHolds = holds
    .filter((h) => h.tourScheduleId !== null)
    .sort((a, b) => (a.tourScheduleId! < b.tourScheduleId! ? -1 : 1));
  for (const h of tourHolds) {
    await lockTourSchedule(tx, h.tourScheduleId!);
    await tx.tourSchedule.update({
      where: { id: h.tourScheduleId! },
      data: { held: { decrement: h.quantity } },
    });
  }

  const released = await tx.inventoryHold.updateMany({
    where: { bookingId, status: "ACTIVE" },
    data: { status: "RELEASED", releasedAt: now },
  });
  return released.count;
}

/**
 * Turns every ACTIVE hold of a booking into a sale (held → sold) when it is
 * confirmed. Same lock order as creation and release. Idempotent.
 */
export async function convertActiveHolds(tx: Tx, bookingId: bigint): Promise<number> {
  const holds = await tx.inventoryHold.findMany({
    where: { bookingId, status: "ACTIVE" },
    orderBy: [{ stayDate: "asc" }, { id: "asc" }],
  });
  if (holds.length === 0) return 0;
  for (const h of holds) {
    if (h.hotelRoomId !== null && h.stayDate !== null) {
      await lockRoomNights(
        tx,
        h.hotelRoomId,
        h.stayDate,
        new Date(h.stayDate.getTime() + 86_400_000),
      );
      await tx.roomInventory.update({
        where: { roomId_stayDate: { roomId: h.hotelRoomId, stayDate: h.stayDate } },
        data: { held: { decrement: h.quantity }, sold: { increment: h.quantity } },
      });
    } else if (h.tourScheduleId !== null) {
      await lockTourSchedule(tx, h.tourScheduleId);
      await tx.tourSchedule.update({
        where: { id: h.tourScheduleId },
        data: { held: { decrement: h.quantity }, sold: { increment: h.quantity } },
      });
    }
  }
  const converted = await tx.inventoryHold.updateMany({
    where: { bookingId, status: "ACTIVE" },
    data: { status: "CONVERTED" },
  });
  return converted.count;
}
