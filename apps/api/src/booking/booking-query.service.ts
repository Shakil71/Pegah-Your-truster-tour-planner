import { Inject, Injectable } from "@nestjs/common";
import type { AdminBookingListQuery, BookingDetail, BookingSummary } from "@pegah/contracts";
import type { Prisma } from "@pegah/db";
import { toMoney } from "../common/money";
import { ProblemException } from "../common/problem";
import { PRISMA, type Db } from "../prisma/prisma.service";
import { allowedTransitions, type BookingActor } from "./booking-state-machine";
import { decodeCursor, encodeCursor, toBookingSummary } from "./booking.mappers";
import { breakdown } from "./offer";

export interface BookingPage {
  items: BookingSummary[];
  nextCursor: string | null;
}

@Injectable()
export class BookingQueryService {
  constructor(@Inject(PRISMA) private readonly db: Db) {}

  /** Staff listing. Callers must hold booking:read (checked by the guard). */
  async listAll(query: AdminBookingListQuery): Promise<BookingPage> {
    const where: Prisma.BookingWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.productType) where.productType = query.productType;
    if (query.q) {
      where.OR = [
        { reference: { startsWith: query.q.toUpperCase() } },
        { contactName: { contains: query.q } },
        { contactEmail: { startsWith: query.q.toLowerCase() } },
      ];
    }
    return this.page(where, query.cursor, query.limit);
  }

  /** A customer's own bookings — ownership is part of the query. */
  async listForUser(
    userId: bigint,
    cursor: string | undefined,
    limit: number,
  ): Promise<BookingPage> {
    return this.page({ userId }, cursor, limit);
  }

  async detail(
    publicId: string,
    actor: BookingActor,
    ownerUserId?: bigint,
  ): Promise<BookingDetail> {
    const booking = await this.db.booking.findFirst({
      // For customers, a booking that is not theirs is indistinguishable from a missing one.
      where: { publicId, ...(ownerUserId !== undefined ? { userId: ownerUserId } : {}) },
      include: {
        history: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
        items: { orderBy: { id: "asc" } },
        guests: { orderBy: [{ isLead: "desc" }, { id: "asc" }] },
      },
    });
    if (!booking) throw new ProblemException(404, "booking-not-found", "Booking not found");
    return {
      ...toBookingSummary(booking),
      contactEmail: booking.contactEmail,
      contactPhone: booking.contactPhone,
      holdExpiresAt:
        booking.status === "PENDING_PAYMENT" && booking.holdExpiresAt
          ? booking.holdExpiresAt.toISOString()
          : null,
      price: breakdown(booking, booking.currency),
      items: booking.items.map((i) => ({
        type: i.itemType,
        description: i.description,
        quantity: i.quantity,
        amount: toMoney(i.amountMinor, i.currency),
      })),
      travellers: booking.guests.map((g) => ({
        fullName: g.fullName,
        ageGroup: g.ageGroup,
        isLead: g.isLead,
      })),
      history: booking.history.map((h) => ({
        from: h.fromStatus,
        to: h.toStatus,
        actorType: h.actorType,
        reason: h.reason,
        at: h.createdAt.toISOString(),
      })),
      allowedTransitions: allowedTransitions(booking.status, actor),
    };
  }

  private async page(
    where: Prisma.BookingWhereInput,
    cursor: string | undefined,
    limit: number,
  ): Promise<BookingPage> {
    const before = decodeCursor(cursor);
    const rows = await this.db.booking.findMany({
      where: before !== undefined ? { AND: [where, { id: { lt: before } }] } : where,
      orderBy: { id: "desc" },
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);
    return {
      items: items.map(toBookingSummary),
      nextCursor: hasMore && items.length > 0 ? encodeCursor(items[items.length - 1]!.id) : null,
    };
  }
}
