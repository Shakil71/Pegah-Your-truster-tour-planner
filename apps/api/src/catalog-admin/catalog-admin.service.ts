import { Inject, Injectable } from "@nestjs/common";
import type {
  AdminDeparture,
  AdminDestination,
  AdminHotelDetail,
  AdminHotelSummary,
  AdminRoom,
  AdminTourDetail,
  AdminTourSummary,
  CalendarQuery,
  CalendarUpdate,
  CreateDeparture,
  CreateDestination,
  CreateHotel,
  CreateTour,
  DestinationInput,
  HotelInput,
  RoomCalendar,
  RoomInput,
  TourInput,
  UpdateDeparture,
} from "@pegah/contracts";
import { Prisma, type BookingStatus } from "@pegah/db";
import { AuditService } from "../audit/audit.service";
import type { AuthContext } from "../auth/auth.types";
import { lockRoomNights, lockTourSchedule, type Tx } from "../booking/inventory";
import { newPublicId } from "../common/ids";
import { toMoney } from "../common/money";
import { ProblemException } from "../common/problem";
import { addDays, dhakaToday, formatCalendarDate, parseCalendarDate } from "../common/time";
import { PRISMA, type Db } from "../prisma/prisma.service";

/** Bookings that still occupy inventory or need attention. */
const ACTIVE: BookingStatus[] = [
  "PENDING_PAYMENT",
  "PAYMENT_PROCESSING",
  "CONFIRMED",
  "MANUAL_REVIEW",
  "CANCELLATION_REQUESTED",
];
const MAX_DAYS_AHEAD = 400;
const MAX_RANGE_DAYS = 400;

const notFound = (what: string) =>
  new ProblemException(
    404,
    `${what}-not-found`,
    `${what[0]!.toUpperCase()}${what.slice(1)} not found`,
  );

function uniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * Back-office catalog and inventory (Phase 6, ADR-0023). Business rules:
 *  - slugs are fixed at creation (stable links);
 *  - rooms on sale can never drop below rooms already held or sold, and a
 *    departure's capacity never below seats held or sold (checked under row
 *    locks, and by the CHECK constraints);
 *  - a departure with held or sold seats cannot be cancelled here (close it,
 *    then handle its bookings);
 *  - price and rate changes affect new bookings only (bookings keep snapshots);
 *  - every change is audited with the staff member and IP.
 */
@Injectable()
export class CatalogAdminService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  // ─── Destinations ─────────────────────────────────────────────────────────

  async listDestinations(): Promise<AdminDestination[]> {
    const rows = await this.db.destination.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { hotels: true, tours: true } } },
    });
    return rows.map((d) => ({
      slug: d.slug,
      name: d.name,
      nameBn: d.nameBn,
      region: d.region,
      summary: d.summary,
      status: d.status,
      sortOrder: d.sortOrder,
      hotelCount: d._count.hotels,
      tourCount: d._count.tours,
      updatedAt: d.updatedAt.toISOString(),
    }));
  }

  async createDestination(input: CreateDestination, actor: AuthContext, ip: string | null) {
    try {
      await this.db.$transaction(async (tx) => {
        await tx.destination.create({ data: { ...input, nameBn: input.nameBn ?? null } });
        await this.record(tx, actor, ip, "catalog.destination.created", "destination", input.slug, {
          name: input.name,
          status: input.status,
        });
      });
    } catch (error) {
      if (uniqueViolation(error)) throw slugTaken();
      throw error;
    }
    return this.destination(input.slug);
  }

  async updateDestination(
    slug: string,
    input: DestinationInput,
    actor: AuthContext,
    ip: string | null,
  ) {
    await this.db.$transaction(async (tx) => {
      const found = await tx.destination.findUnique({ where: { slug }, select: { id: true } });
      if (!found) throw notFound("destination");
      await tx.destination.update({
        where: { id: found.id },
        data: { ...input, nameBn: input.nameBn ?? null },
      });
      await this.record(tx, actor, ip, "catalog.destination.updated", "destination", slug, {
        status: input.status,
      });
    });
    return this.destination(slug);
  }

  private async destination(slug: string): Promise<AdminDestination> {
    const d = (await this.listDestinations()).find((x) => x.slug === slug);
    if (!d) throw notFound("destination");
    return d;
  }

  private async destinationId(tx: Pick<Tx, "destination">, slug: string): Promise<bigint> {
    const d = await tx.destination.findUnique({ where: { slug }, select: { id: true } });
    if (!d) {
      throw new ProblemException(
        422,
        "unknown-destination",
        "Unknown destination",
        `No destination "${slug}".`,
      );
    }
    return d.id;
  }

  // ─── Hotels ───────────────────────────────────────────────────────────────

  async listHotels(): Promise<AdminHotelSummary[]> {
    const rows = await this.db.hotel.findMany({
      orderBy: [{ status: "asc" }, { name: "asc" }],
      include: {
        destination: { select: { slug: true, name: true } },
        _count: { select: { rooms: true } },
      },
    });
    const active = await this.activeBookingsBy("hotel");
    return rows.map((h) => ({
      id: h.publicId,
      slug: h.slug,
      name: h.name,
      destination: h.destination,
      starRating: h.starRating,
      status: h.status,
      roomCount: h._count.rooms,
      activeBookings: active.get(h.id) ?? 0,
      updatedAt: h.updatedAt.toISOString(),
    }));
  }

  async hotel(slug: string): Promise<AdminHotelDetail> {
    const h = await this.db.hotel.findUnique({
      where: { slug },
      include: {
        destination: { select: { slug: true, name: true } },
        rooms: { orderBy: [{ isActive: "desc" }, { maxAdults: "asc" }, { name: "asc" }] },
      },
    });
    if (!h) throw notFound("hotel");
    const active = await this.activeBookingsBy("hotel", h.id);
    return {
      id: h.publicId,
      slug: h.slug,
      name: h.name,
      nameBn: h.nameBn,
      destination: h.destination,
      starRating: h.starRating,
      status: h.status,
      roomCount: h.rooms.length,
      activeBookings: active.get(h.id) ?? 0,
      updatedAt: h.updatedAt.toISOString(),
      addressLine: h.addressLine,
      summary: h.summary,
      description: h.description,
      checkInTime: h.checkInTime,
      checkOutTime: h.checkOutTime,
      cancellationPolicy: h.cancellationPolicy,
      serviceChargeBps: h.serviceChargeBps,
      vatBps: h.vatBps,
      rooms: h.rooms.map(toAdminRoom),
    };
  }

  async createHotel(input: CreateHotel, actor: AuthContext, ip: string | null) {
    const { destinationSlug, ...fields } = input;
    try {
      await this.db.$transaction(async (tx) => {
        const destinationId = await this.destinationId(tx, destinationSlug);
        await tx.hotel.create({
          data: {
            ...fields,
            publicId: newPublicId(),
            destinationId,
            nameBn: fields.nameBn ?? null,
            description: fields.description ?? null,
          },
        });
        await this.record(tx, actor, ip, "catalog.hotel.created", "hotel", input.slug, {
          name: input.name,
          status: input.status,
        });
      });
    } catch (error) {
      if (uniqueViolation(error)) throw slugTaken();
      throw error;
    }
    return this.hotel(input.slug);
  }

  async updateHotel(slug: string, input: HotelInput, actor: AuthContext, ip: string | null) {
    const { destinationSlug, ...fields } = input;
    await this.db.$transaction(async (tx) => {
      const found = await tx.hotel.findUnique({ where: { slug } });
      if (!found) throw notFound("hotel");
      const destinationId = await this.destinationId(tx, destinationSlug);
      await tx.hotel.update({
        where: { id: found.id },
        data: {
          ...fields,
          destinationId,
          nameBn: fields.nameBn ?? null,
          description: fields.description ?? null,
        },
      });
      await this.record(tx, actor, ip, "catalog.hotel.updated", "hotel", slug, {
        changed: changedKeys(found, { ...fields, destinationId }),
      });
    });
    return this.hotel(slug);
  }

  // ─── Rooms ────────────────────────────────────────────────────────────────

  async createRoom(hotelSlug: string, input: RoomInput, actor: AuthContext, ip: string | null) {
    try {
      return await this.db.$transaction(async (tx) => {
        const hotel = await tx.hotel.findUnique({
          where: { slug: hotelSlug },
          select: { id: true },
        });
        if (!hotel) throw notFound("hotel");
        const room = await tx.hotelRoom.create({
          data: { ...input, publicId: newPublicId(), hotelId: hotel.id },
        });
        await this.record(tx, actor, ip, "catalog.room.created", "room", room.publicId, {
          hotel: hotelSlug,
          name: input.name,
        });
        return toAdminRoom(room);
      });
    } catch (error) {
      if (uniqueViolation(error)) throw roomNameTaken();
      throw error;
    }
  }

  async updateRoom(roomId: string, input: RoomInput, actor: AuthContext, ip: string | null) {
    try {
      return await this.db.$transaction(async (tx) => {
        const found = await tx.hotelRoom.findUnique({ where: { publicId: roomId } });
        if (!found) throw notFound("room");
        const room = await tx.hotelRoom.update({ where: { id: found.id }, data: input });
        await this.record(tx, actor, ip, "catalog.room.updated", "room", roomId, {
          changed: changedKeys(found, input),
        });
        return toAdminRoom(room);
      });
    } catch (error) {
      if (uniqueViolation(error)) throw roomNameTaken();
      throw error;
    }
  }

  // ─── Inventory and rate calendar ─────────────────────────────────────────

  async calendar(roomId: string, q: CalendarQuery): Promise<RoomCalendar> {
    const room = await this.db.hotelRoom.findUnique({
      where: { publicId: roomId },
      include: { hotel: { select: { slug: true, name: true, currency: true } } },
    });
    if (!room) throw notFound("room");
    const from = parseCalendarDate(q.from);
    const to = addDays(from, q.days);
    const range = { gte: from, lt: to };
    const [inventory, rates] = await Promise.all([
      this.db.roomInventory.findMany({ where: { roomId: room.id, stayDate: range } }),
      this.db.roomRate.findMany({ where: { roomId: room.id, stayDate: range } }),
    ]);
    const inv = new Map(inventory.map((i) => [i.stayDate.getTime(), i]));
    const rate = new Map(rates.map((r) => [r.stayDate.getTime(), r]));
    return {
      room: { id: room.publicId, name: room.name },
      hotel: room.hotel,
      days: Array.from({ length: q.days }, (_, i) => {
        const d = addDays(from, i);
        const iv = inv.get(d.getTime());
        const rt = rate.get(d.getTime());
        return {
          date: formatCalendarDate(d),
          total: iv?.total ?? null,
          held: iv?.held ?? 0,
          sold: iv?.sold ?? 0,
          rate: rt ? toMoney(rt.amountMinor, rt.currency) : null,
        };
      }),
    };
  }

  async updateCalendar(
    roomId: string,
    input: CalendarUpdate,
    actor: AuthContext,
    ip: string | null,
    now: Date = new Date(),
  ): Promise<{ datesUpdated: number }> {
    const from = parseCalendarDate(input.from);
    const to = parseCalendarDate(input.to);
    const today = dhakaToday(now);
    if (from < today) {
      throw new ProblemException(422, "past-dates", "Past dates cannot be changed");
    }
    if (
      to > addDays(today, MAX_DAYS_AHEAD) ||
      (to.getTime() - from.getTime()) / 86_400_000 >= MAX_RANGE_DAYS
    ) {
      throw new ProblemException(
        422,
        "range-too-large",
        "Range too large",
        `At most ${MAX_RANGE_DAYS} days, up to ${MAX_DAYS_AHEAD} days ahead.`,
      );
    }
    const weekdays = input.weekdays ? new Set(input.weekdays) : null;
    const dates: Date[] = [];
    for (let d = from; d <= to; d = addDays(d, 1)) {
      if (!weekdays || weekdays.has(d.getUTCDay())) dates.push(d);
    }
    if (dates.length === 0) return { datesUpdated: 0 };

    return this.db.$transaction(
      async (tx) => {
        const room = await tx.hotelRoom.findUnique({
          where: { publicId: roomId },
          include: { hotel: { select: { currency: true, slug: true } } },
        });
        if (!room) throw notFound("room");
        if (input.rate && input.rate.currency !== room.hotel.currency) {
          throw new ProblemException(
            422,
            "currency-mismatch",
            "Wrong currency",
            `This hotel sells in ${room.hotel.currency}.`,
          );
        }
        // Same lock as booking creation: no hold can slip in while we check.
        await lockRoomNights(tx, room.id, from, addDays(to, 1));

        if (input.total !== undefined) {
          const conflicts = await tx.roomInventory.findMany({
            where: { roomId: room.id, stayDate: { in: dates } },
            select: { stayDate: true, held: true, sold: true },
          });
          const tooLow = conflicts.filter((c) => c.held + c.sold > input.total!);
          if (tooLow.length > 0) {
            throw new ProblemException(
              409,
              "below-committed",
              "Fewer rooms than already booked",
              `These dates already have more rooms held or sold than ${input.total}: ${tooLow
                .slice(0, 10)
                .map((c) => formatCalendarDate(c.stayDate))
                .join(", ")}${tooLow.length > 10 ? " …" : ""}.`,
            );
          }
          await tx.roomInventory.createMany({
            data: dates.map((stayDate) => ({ roomId: room.id, stayDate, total: input.total! })),
            skipDuplicates: true,
          });
          await tx.roomInventory.updateMany({
            where: { roomId: room.id, stayDate: { in: dates } },
            data: { total: input.total },
          });
        }
        if (input.rate) {
          const amountMinor = BigInt(input.rate.amountMinor);
          await tx.roomRate.createMany({
            data: dates.map((stayDate) => ({
              roomId: room.id,
              stayDate,
              amountMinor,
              currency: room.hotel.currency,
            })),
            skipDuplicates: true,
          });
          await tx.roomRate.updateMany({
            where: { roomId: room.id, stayDate: { in: dates } },
            data: { amountMinor },
          });
        }
        await this.record(tx, actor, ip, "inventory.calendar.updated", "room", roomId, {
          hotel: room.hotel.slug,
          from: input.from,
          to: input.to,
          weekdays: input.weekdays ?? null,
          total: input.total ?? null,
          rateMinor: input.rate?.amountMinor ?? null,
          dates: dates.length,
        });
        return { datesUpdated: dates.length };
      },
      { timeout: 20_000 },
    );
  }

  // ─── Tours and departures ────────────────────────────────────────────────

  async listTours(now: Date = new Date()): Promise<AdminTourSummary[]> {
    const rows = await this.db.tour.findMany({
      orderBy: [{ status: "asc" }, { title: "asc" }],
      include: {
        destination: { select: { slug: true, name: true } },
        _count: {
          select: { schedules: { where: { status: "SCHEDULED", departsAt: { gt: now } } } },
        },
      },
    });
    const active = await this.activeBookingsBy("tour");
    return rows.map((t) => ({
      id: t.publicId,
      slug: t.slug,
      title: t.title,
      destination: t.destination,
      status: t.status,
      durationDays: t.durationDays,
      upcomingDepartures: t._count.schedules,
      activeBookings: active.get(t.id) ?? 0,
      updatedAt: t.updatedAt.toISOString(),
    }));
  }

  async tour(slug: string, now: Date = new Date()): Promise<AdminTourDetail> {
    const t = await this.db.tour.findUnique({
      where: { slug },
      include: {
        destination: { select: { slug: true, name: true } },
        schedules: { orderBy: { departsAt: "asc" } },
      },
    });
    if (!t) throw notFound("tour");
    const active = await this.activeBookingsBy("tour", t.id);
    const list = (v: unknown) =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
    return {
      id: t.publicId,
      slug: t.slug,
      title: t.title,
      titleBn: t.titleBn,
      destination: t.destination,
      status: t.status,
      durationDays: t.durationDays,
      durationNights: t.durationNights,
      upcomingDepartures: t.schedules.filter((s) => s.status === "SCHEDULED" && s.departsAt > now)
        .length,
      activeBookings: active.get(t.id) ?? 0,
      updatedAt: t.updatedAt.toISOString(),
      summary: t.summary,
      description: t.description,
      meetingPoint: t.meetingPoint,
      groupSizeMax: t.groupSizeMax,
      highlights: list(t.highlights),
      includes: list(t.includes),
      excludes: list(t.excludes),
      vatBps: t.vatBps,
      departures: t.schedules.map(toAdminDeparture),
    };
  }

  async createTour(input: CreateTour, actor: AuthContext, ip: string | null) {
    const { destinationSlug, ...fields } = input;
    try {
      await this.db.$transaction(async (tx) => {
        const destinationId = await this.destinationId(tx, destinationSlug);
        await tx.tour.create({
          data: {
            ...fields,
            publicId: newPublicId(),
            destinationId,
            titleBn: fields.titleBn ?? null,
          },
        });
        await this.record(tx, actor, ip, "catalog.tour.created", "tour", input.slug, {
          title: input.title,
          status: input.status,
        });
      });
    } catch (error) {
      if (uniqueViolation(error)) throw slugTaken();
      throw error;
    }
    return this.tour(input.slug);
  }

  async updateTour(slug: string, input: TourInput, actor: AuthContext, ip: string | null) {
    const { destinationSlug, ...fields } = input;
    await this.db.$transaction(async (tx) => {
      const found = await tx.tour.findUnique({ where: { slug } });
      if (!found) throw notFound("tour");
      const destinationId = await this.destinationId(tx, destinationSlug);
      await tx.tour.update({
        where: { id: found.id },
        data: { ...fields, destinationId, titleBn: fields.titleBn ?? null },
      });
      await this.record(tx, actor, ip, "catalog.tour.updated", "tour", slug, {
        changed: changedKeys(found, { ...fields, destinationId }),
      });
    });
    return this.tour(slug);
  }

  async createDeparture(
    tourSlug: string,
    input: CreateDeparture,
    actor: AuthContext,
    ip: string | null,
    now: Date = new Date(),
  ): Promise<AdminDeparture> {
    const departsAt = new Date(input.departsAt);
    if (departsAt <= now)
      throw new ProblemException(422, "past-departure", "Departure must be in the future");
    return this.db.$transaction(async (tx) => {
      const tour = await tx.tour.findUnique({ where: { slug: tourSlug } });
      if (!tour) throw notFound("tour");
      for (const m of [input.priceAdult, input.priceChild]) {
        if (m.currency !== tour.currency) {
          throw new ProblemException(
            422,
            "currency-mismatch",
            "Wrong currency",
            `This tour sells in ${tour.currency}.`,
          );
        }
      }
      const s = await tx.tourSchedule.create({
        data: {
          publicId: newPublicId(),
          tourId: tour.id,
          departsAt,
          returnsAt: new Date(input.returnsAt),
          capacity: input.capacity,
          priceAdultMinor: BigInt(input.priceAdult.amountMinor),
          priceChildMinor: BigInt(input.priceChild.amountMinor),
          currency: tour.currency,
        },
      });
      await this.record(tx, actor, ip, "inventory.departure.created", "departure", s.publicId, {
        tour: tourSlug,
        departsAt: input.departsAt,
        capacity: input.capacity,
      });
      return toAdminDeparture(s);
    });
  }

  async updateDeparture(
    departureId: string,
    input: UpdateDeparture,
    actor: AuthContext,
    ip: string | null,
  ): Promise<AdminDeparture> {
    return this.db.$transaction(async (tx) => {
      const found = await tx.tourSchedule.findUnique({
        where: { publicId: departureId },
        include: { tour: { select: { currency: true, slug: true } } },
      });
      if (!found) throw notFound("departure");
      await lockTourSchedule(tx, found.id);
      const s = await tx.tourSchedule.findUniqueOrThrow({ where: { id: found.id } });
      const committed = s.held + s.sold;
      if (input.capacity !== undefined && input.capacity < committed) {
        throw new ProblemException(
          409,
          "below-committed",
          "Fewer seats than already booked",
          `${committed} seats are already held or sold on this departure.`,
        );
      }
      if (input.status === "CANCELLED" && committed > 0) {
        throw new ProblemException(
          409,
          "departure-has-bookings",
          "Departure has bookings",
          `Close the departure first, then cancel or move its ${committed} booked seats.`,
        );
      }
      for (const m of [input.priceAdult, input.priceChild]) {
        if (m && m.currency !== found.tour.currency) {
          throw new ProblemException(
            422,
            "currency-mismatch",
            "Wrong currency",
            `This tour sells in ${found.tour.currency}.`,
          );
        }
      }
      const updated = await tx.tourSchedule.update({
        where: { id: s.id },
        data: {
          ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
          ...(input.priceAdult ? { priceAdultMinor: BigInt(input.priceAdult.amountMinor) } : {}),
          ...(input.priceChild ? { priceChildMinor: BigInt(input.priceChild.amountMinor) } : {}),
          ...(input.status ? { status: input.status } : {}),
        },
      });
      await this.record(tx, actor, ip, "inventory.departure.updated", "departure", departureId, {
        tour: found.tour.slug,
        capacity: input.capacity ?? null,
        priceAdultMinor: input.priceAdult?.amountMinor ?? null,
        priceChildMinor: input.priceChild?.amountMinor ?? null,
        status: input.status ?? null,
      });
      return toAdminDeparture(updated);
    });
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  /** Active booking counts per hotel or tour id. */
  private async activeBookingsBy(
    kind: "hotel" | "tour",
    onlyId?: bigint,
  ): Promise<Map<bigint, number>> {
    const items = await this.db.bookingItem.findMany({
      where: {
        booking: { status: { in: ACTIVE } },
        ...(kind === "hotel"
          ? { hotelRoom: onlyId !== undefined ? { hotelId: onlyId } : { isNot: null } }
          : { tourSchedule: onlyId !== undefined ? { tourId: onlyId } : { isNot: null } }),
      },
      select: {
        bookingId: true,
        hotelRoom: { select: { hotelId: true } },
        tourSchedule: { select: { tourId: true } },
      },
    });
    const sets = new Map<bigint, Set<bigint>>();
    for (const i of items) {
      const key = kind === "hotel" ? i.hotelRoom?.hotelId : i.tourSchedule?.tourId;
      if (key === undefined) continue;
      if (!sets.has(key)) sets.set(key, new Set());
      sets.get(key)!.add(i.bookingId);
    }
    return new Map([...sets].map(([k, v]) => [k, v.size]));
  }

  private record(
    tx: Tx,
    actor: AuthContext,
    ip: string | null,
    action: string,
    targetType: string,
    targetId: string,
    metadata: Prisma.InputJsonValue,
  ) {
    return this.audit.record(
      {
        actorType: "STAFF",
        actorUserId: actor.user.id,
        action,
        targetType,
        targetId,
        ipAddress: ip,
        metadata,
      },
      tx,
    );
  }
}

function toAdminRoom(r: {
  publicId: string;
  name: string;
  description: string;
  maxAdults: number;
  maxChildren: number;
  bedType: string;
  sizeSqm: number | null;
  isActive: boolean;
}): AdminRoom {
  return {
    id: r.publicId,
    name: r.name,
    description: r.description,
    maxAdults: r.maxAdults,
    maxChildren: r.maxChildren,
    bedType: r.bedType,
    sizeSqm: r.sizeSqm,
    isActive: r.isActive,
  };
}

function toAdminDeparture(s: {
  publicId: string;
  departsAt: Date;
  returnsAt: Date;
  capacity: number;
  held: number;
  sold: number;
  priceAdultMinor: bigint;
  priceChildMinor: bigint;
  currency: string;
  status: "SCHEDULED" | "CLOSED" | "CANCELLED";
}): AdminDeparture {
  return {
    id: s.publicId,
    departsAt: s.departsAt.toISOString(),
    returnsAt: s.returnsAt.toISOString(),
    capacity: s.capacity,
    held: s.held,
    sold: s.sold,
    priceAdult: toMoney(s.priceAdultMinor, s.currency),
    priceChild: toMoney(s.priceChildMinor, s.currency),
    status: s.status,
  };
}

/** Field names whose values changed (for the audit trail; values are not logged). */
function changedKeys(before: Record<string, unknown>, after: Record<string, unknown>): string[] {
  return Object.keys(after).filter((k) => {
    const a = before[k];
    const b = after[k];
    return (
      JSON.stringify(a, (_, v) => (typeof v === "bigint" ? v.toString() : v)) !==
      JSON.stringify(b, (_, v) => (typeof v === "bigint" ? v.toString() : v))
    );
  });
}

const slugTaken = () =>
  new ProblemException(409, "slug-taken", "Address already in use", "Choose a different URL slug.");
const roomNameTaken = () =>
  new ProblemException(
    409,
    "room-name-taken",
    "Room name already used",
    "Each room type in a hotel needs its own name.",
  );
