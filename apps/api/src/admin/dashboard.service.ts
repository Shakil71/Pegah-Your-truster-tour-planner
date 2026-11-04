import { Inject, Injectable } from "@nestjs/common";
import { BOOKING_STATUSES, type DashboardSummary } from "@pegah/contracts";
import type { BookingStatus } from "@pegah/db";
import { toBookingSummary } from "../booking/booking.mappers";
import { toMoney } from "../common/money";
import { addDays, dhakaToday, formatCalendarDate } from "../common/time";
import { PRISMA, type Db } from "../prisma/prisma.service";

const CONFIRMED: BookingStatus[] = ["CONFIRMED", "COMPLETED"];
/** Value that is held or awaiting a decision: not revenue yet. */
const PENDING: BookingStatus[] = [
  "PENDING_PAYMENT",
  "PAYMENT_PROCESSING",
  "MANUAL_REVIEW",
  "CANCELLATION_REQUESTED",
];
const NEEDS_ACTION: BookingStatus[] = ["MANUAL_REVIEW", "CANCELLATION_REQUESTED", "REFUND_PENDING"];
const DAY_MS = 86_400_000;
const DHAKA_OFFSET_MS = 6 * 3_600_000;

/** UTC instant of 00:00 Asia/Dhaka on a calendar date (Dhaka has no DST). */
const dhakaMidnight = (date: Date) => new Date(date.getTime() - DHAKA_OFFSET_MS);

/**
 * Operations dashboard figures, all read from MySQL. Money is summed as
 * BIGINT; only BDT is reported until multi-currency reporting exists.
 */
@Injectable()
export class DashboardService {
  constructor(@Inject(PRISMA) private readonly db: Db) {}

  async summary(now: Date = new Date()): Promise<DashboardSummary> {
    const today = dhakaToday(now);
    const from30 = dhakaMidnight(addDays(today, -29));
    const from60 = dhakaMidnight(addDays(today, -59));

    const [statusGroups, recent30, confirmedPrev, countPrev] = await Promise.all([
      this.db.booking.groupBy({ by: ["status"], _count: { _all: true } }),
      this.db.booking.findMany({
        where: { createdAt: { gte: from30 }, currency: "BDT" },
        select: { createdAt: true, status: true, totalMinor: true },
      }),
      this.db.booking.aggregate({
        where: {
          createdAt: { gte: from60, lt: from30 },
          status: { in: CONFIRMED },
          currency: "BDT",
        },
        _sum: { totalMinor: true },
      }),
      this.db.booking.count({ where: { createdAt: { gte: from60, lt: from30 } } }),
    ]);

    // Day series (Dhaka calendar), oldest first.
    const days = Array.from({ length: 30 }, (_, i) => addDays(today, i - 29));
    const daily = days.map((d) => ({ date: d, bookings: 0, confirmed: 0n, pending: 0n }));
    let confirmed30 = 0n;
    for (const b of recent30) {
      const idx = Math.floor(
        (b.createdAt.getTime() + DHAKA_OFFSET_MS - days[0]!.getTime()) / DAY_MS,
      );
      const slot = daily[idx];
      if (!slot) continue;
      slot.bookings++;
      if (CONFIRMED.includes(b.status)) {
        slot.confirmed += b.totalMinor;
        confirmed30 += b.totalMinor;
      } else if (PENDING.includes(b.status)) {
        slot.pending += b.totalMinor;
      }
    }

    const counts = new Map(statusGroups.map((g) => [g.status, g._count._all]));
    const occupancy = await this.occupancy(today);
    const [departures, recentBookings, activity] = await Promise.all([
      this.db.tourSchedule.findMany({
        where: { status: "SCHEDULED", departsAt: { gt: now } },
        orderBy: { departsAt: "asc" },
        take: 6,
        include: { tour: { select: { title: true, slug: true } } },
      }),
      this.db.booking.findMany({ orderBy: { id: "desc" }, take: 7 }),
      this.db.auditEvent.findMany({ orderBy: { id: "desc" }, take: 8 }),
    ]);
    const actorIds = [
      ...new Set(activity.map((a) => a.actorUserId).filter((v): v is bigint => v !== null)),
    ];
    const actors = new Map(
      (
        await this.db.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, fullName: true },
        })
      ).map((u) => [u.id, u.fullName]),
    );

    return {
      generatedAt: now.toISOString(),
      today: formatCalendarDate(today),
      kpis: {
        confirmedValue30d: toMoney(confirmed30, "BDT"),
        confirmedValuePrev30d: toMoney(confirmedPrev._sum.totalMinor ?? 0n, "BDT"),
        bookings30d: recent30.length,
        bookingsPrev30d: countPrev,
        occupancyNext14d: occupancy.overall,
        pendingPayment: counts.get("PENDING_PAYMENT") ?? 0,
        needsAction: NEEDS_ACTION.reduce((a, s) => a + (counts.get(s) ?? 0), 0),
      },
      statusCounts: BOOKING_STATUSES.filter((s) => counts.has(s)).map((s) => ({
        status: s,
        count: counts.get(s)!,
      })),
      daily: daily.map((d) => ({
        date: formatCalendarDate(d.date),
        bookings: d.bookings,
        confirmed: toMoney(d.confirmed, "BDT"),
        pending: toMoney(d.pending, "BDT"),
      })),
      occupancy: { days: occupancy.days, hotels: occupancy.hotels },
      departures: departures.map((s) => ({
        id: s.publicId,
        tourTitle: s.tour.title,
        tourSlug: s.tour.slug,
        departsAt: s.departsAt.toISOString(),
        capacity: s.capacity,
        held: s.held,
        sold: s.sold,
      })),
      recentBookings: recentBookings.map(toBookingSummary),
      recentActivity: activity.map((a) => ({
        action: a.action,
        actorType: a.actorType,
        actorName: a.actorUserId !== null ? (actors.get(a.actorUserId) ?? null) : null,
        targetType: a.targetType,
        targetId: a.targetId,
        at: a.createdAt.toISOString(),
      })),
    };
  }

  /** Rooms held + sold ÷ total per hotel per night, next 14 nights. */
  private async occupancy(today: Date) {
    const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));
    const rows = await this.db.roomInventory.findMany({
      where: {
        stayDate: { gte: days[0], lte: days[13] },
        room: { isActive: true, hotel: { status: "PUBLISHED" } },
      },
      select: {
        stayDate: true,
        total: true,
        held: true,
        sold: true,
        room: { select: { hotel: { select: { name: true, slug: true } } } },
      },
    });
    const byHotel = new Map<string, { name: string; used: number[]; total: number[] }>();
    let used = 0;
    let total = 0;
    for (const r of rows) {
      const h = r.room.hotel;
      let entry = byHotel.get(h.slug);
      if (!entry) {
        entry = { name: h.name, used: Array(14).fill(0), total: Array(14).fill(0) };
        byHotel.set(h.slug, entry);
      }
      const idx = Math.round((r.stayDate.getTime() - days[0]!.getTime()) / DAY_MS);
      if (idx < 0 || idx > 13) continue;
      entry.used[idx] += r.held + r.sold;
      entry.total[idx] += r.total;
      used += r.held + r.sold;
      total += r.total;
    }
    const hotels = [...byHotel.entries()]
      .sort(([, a], [, b]) => a.name.localeCompare(b.name))
      .slice(0, 8)
      .map(([slug, e]) => ({
        name: e.name,
        slug,
        values: e.total.map((t, i) => (t > 0 ? Math.round((e.used[i]! / t) * 100) : null)),
      }));
    return {
      days: days.map(formatCalendarDate),
      hotels,
      overall: total > 0 ? Math.round((used / total) * 100) : 0,
    };
  }
}
