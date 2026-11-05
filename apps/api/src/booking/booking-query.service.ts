import { Inject, Injectable } from "@nestjs/common";
import type { AdminBookingListQuery, BookingDetail, BookingSummary } from "@pegah/contracts";
import type { Prisma } from "@pegah/db";
import { toMoney } from "../common/money";
import { ProblemException } from "../common/problem";
import { APP_CONFIG, type AppConfig } from "../config/config";
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
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

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
    if (query.customerId) where.user = { publicId: query.customerId };
    if (query.hotel) where.items = { some: { hotelRoom: { hotel: { slug: query.hotel } } } };
    if (query.tour) where.items = { some: { tourSchedule: { tour: { slug: query.tour } } } };
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
        items: {
          orderBy: { id: "asc" },
          include: {
            hotelRoom: {
              select: {
                hotel: {
                  select: {
                    slug: true,
                    addressLine: true,
                    checkInTime: true,
                    checkOutTime: true,
                    cancellationPolicy: true,
                  },
                },
              },
            },
            tourSchedule: {
              select: { publicId: true, tour: { select: { slug: true, meetingPoint: true } } },
            },
          },
        },
        user: { select: { publicId: true, fullName: true, email: true } },
        guests: { orderBy: [{ isLead: "desc" }, { id: "asc" }] },
        payments: { orderBy: { id: "desc" } },
        refunds: { orderBy: { id: "desc" } },
        promotion: { select: { code: true } },
        agent: { select: { name: true } },
        ...(actor === "STAFF" ? { emails: { orderBy: { id: "desc" as const }, take: 30 } } : {}),
      },
    });
    if (!booking) throw new ProblemException(404, "booking-not-found", "Booking not found");
    const first = booking.items[0];
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
      payments: booking.payments.map((p) => ({
        id: p.publicId,
        provider: p.provider,
        status: p.status,
        amount: toMoney(p.amountMinor, p.currency),
        method: p.method,
        failureReason: p.failureReason,
        createdAt: p.createdAt.toISOString(),
        succeededAt: p.succeededAt?.toISOString() ?? null,
      })),
      canPay:
        this.config.PAYMENT_PROVIDER !== "none" &&
        booking.status === "PENDING_PAYMENT" &&
        booking.holdExpiresAt !== null &&
        booking.holdExpiresAt.getTime() - Date.now() > 60_000,
      customer: {
        id: booking.user.publicId,
        fullName: booking.user.fullName,
        email: booking.user.email,
      },
      product: {
        type: booking.productType,
        slug: first?.hotelRoom?.hotel.slug ?? first?.tourSchedule?.tour.slug ?? "",
        departureId: first?.tourSchedule?.publicId ?? null,
        location:
          first?.hotelRoom?.hotel.addressLine ?? first?.tourSchedule?.tour.meetingPoint ?? null,
        checkInTime: first?.hotelRoom?.hotel.checkInTime ?? null,
        checkOutTime: first?.hotelRoom?.hotel.checkOutTime ?? null,
        cancellationPolicy: first?.hotelRoom?.hotel.cancellationPolicy ?? null,
      },
      promotionCode: booking.promotion?.code ?? null,
      agent: booking.agent
        ? {
            name: booking.agent.name,
            commission: toMoney(booking.commissionMinor, booking.currency),
          }
        : null,
      refunds: booking.refunds.map((r) => ({
        id: r.publicId,
        amount: toMoney(r.amountMinor, r.currency),
        status: r.status,
        reason: r.reason,
        providerRef: r.providerRef,
        createdAt: r.createdAt.toISOString(),
        paidAt: r.paidAt?.toISOString() ?? null,
      })),
      ...("emails" in booking && Array.isArray(booking.emails)
        ? {
            emails: (
              booking.emails as {
                template: string;
                toAddress: string;
                subject: string;
                status: "QUEUED" | "SENT" | "FAILED" | "SKIPPED";
                createdAt: Date;
              }[]
            ).map((e) => ({
              template: e.template,
              to: e.toAddress,
              subject: e.subject,
              status: e.status,
              at: e.createdAt.toISOString(),
            })),
          }
        : {}),
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
