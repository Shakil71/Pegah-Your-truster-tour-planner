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
import { APP_CONFIG, type AppConfig } from "../config/config";
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
const GALLERY = {
  orderBy: { sortOrder: "asc" },
  include: { media: { select: { storageKey: true, altText: true } } },
} as const;
const PROPERTY_TYPES = ["HOTEL", "RESORT", "HOTEL_RESORT"] as const;
type RoomWithMedia = Prisma.HotelRoomGetPayload<{
  include: {
    gallery: typeof GALLERY;
    amenities: { select: { amenity: { select: { slug: true } } } };
  };
}>;
const airConditionedField = (v: "YES" | "NO" | "UNKNOWN" | undefined) =>
  v === undefined ? {} : { airConditioned: v === "UNKNOWN" ? null : v === "YES" };
const stringArray = (v: unknown) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

@Injectable()
export class CatalogAdminService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Main photo as shown in the console (key, URL, alt). */
  private heroRef(m: { storageKey: string; altText: string } | null) {
    if (!m) return null;
    const base = this.config.MEDIA_BASE_URL.replace(/\/$/, "");
    return { key: m.storageKey, url: `${base}/${m.storageKey}`, alt: m.altText };
  }

  /** Media key → asset id for a hero photo; undefined keeps, null clears. */
  private async heroId(
    tx: Pick<Tx, "mediaAsset">,
    key: string | null | undefined,
  ): Promise<{ heroMediaId?: bigint | null }> {
    if (key === undefined) return {};
    if (key === null) return { heroMediaId: null };
    const m = await tx.mediaAsset.findUnique({ where: { storageKey: key }, select: { id: true } });
    if (!m) {
      throw new ProblemException(
        422,
        "unknown-media",
        "Unknown image",
        "Pick an image from the media library.",
      );
    }
    return { heroMediaId: m.id };
  }

  /** Replaces a gallery with the given media keys (in order); undefined keeps it. */
  private async setGallery(
    tx: Tx,
    kind: "hotel" | "room" | "tour",
    ownerId: bigint,
    keys: string[] | undefined,
  ) {
    if (keys === undefined) return;
    const unique = [...new Set(keys)];
    const media = await tx.mediaAsset.findMany({
      where: { storageKey: { in: unique } },
      select: { id: true, storageKey: true },
    });
    if (media.length !== unique.length) {
      throw new ProblemException(
        422,
        "unknown-media",
        "Unknown image",
        "Pick images from the media library.",
      );
    }
    const id = new Map(media.map((m) => [m.storageKey, m.id]));
    const rows = unique.map((k, sortOrder) => ({ mediaId: id.get(k)!, sortOrder }));
    if (kind === "hotel") {
      await tx.hotelMedia.deleteMany({ where: { hotelId: ownerId } });
      await tx.hotelMedia.createMany({ data: rows.map((r) => ({ ...r, hotelId: ownerId })) });
    } else if (kind === "room") {
      await tx.roomMedia.deleteMany({ where: { roomId: ownerId } });
      await tx.roomMedia.createMany({ data: rows.map((r) => ({ ...r, roomId: ownerId })) });
    } else {
      await tx.tourMedia.deleteMany({ where: { tourId: ownerId } });
      await tx.tourMedia.createMany({ data: rows.map((r) => ({ ...r, tourId: ownerId })) });
    }
  }

  /** Replaces the amenities (by slug within the scope); undefined keeps them. */
  private async setAmenities(
    tx: Tx,
    kind: "hotel" | "room" | "tour",
    ownerId: bigint,
    slugs: string[] | undefined,
  ) {
    if (slugs === undefined) return;
    const scope = kind === "hotel" ? "HOTEL" : kind === "room" ? "ROOM" : "TOUR";
    const unique = [...new Set(slugs)];
    const found = await tx.amenity.findMany({
      where: { scope, slug: { in: unique } },
      select: { id: true },
    });
    if (found.length !== unique.length) {
      throw new ProblemException(
        422,
        "unknown-amenity",
        "Unknown facility",
        "Pick facilities from the list.",
      );
    }
    if (kind === "hotel") {
      await tx.hotelAmenity.deleteMany({ where: { hotelId: ownerId } });
      await tx.hotelAmenity.createMany({
        data: found.map((a) => ({ hotelId: ownerId, amenityId: a.id })),
      });
    } else if (kind === "room") {
      await tx.roomAmenity.deleteMany({ where: { roomId: ownerId } });
      await tx.roomAmenity.createMany({
        data: found.map((a) => ({ roomId: ownerId, amenityId: a.id })),
      });
    } else {
      await tx.tourAmenity.deleteMany({ where: { tourId: ownerId } });
      await tx.tourAmenity.createMany({
        data: found.map((a) => ({ tourId: ownerId, amenityId: a.id })),
      });
    }
  }

  private galleryRefs(rows: Array<{ media: { storageKey: string; altText: string } }>) {
    return rows.map((r) => this.heroRef(r.media)!);
  }

  // ─── Amenities ────────────────────────────────────────────────────────────

  async listAmenities(scope: "HOTEL" | "ROOM" | "TOUR") {
    const rows = await this.db.amenity.findMany({
      where: { scope },
      orderBy: [{ groupName: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    });
    return { items: rows.map((a) => ({ slug: a.slug, name: a.name, group: a.groupName })) };
  }

  async createAmenity(
    input: { scope: "HOTEL" | "ROOM" | "TOUR"; name: string; group?: string | null },
    actor: AuthContext,
    ip: string | null,
  ) {
    const slug =
      input.name
        .toLowerCase()
        .replace(/['’]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80) || "facility";
    return this.db.$transaction(async (tx) => {
      const existing = await tx.amenity.findUnique({
        where: { scope_slug: { scope: input.scope, slug } },
      });
      const a =
        existing ??
        (await tx.amenity.create({
          data: { scope: input.scope, slug, name: input.name, groupName: input.group ?? null },
        }));
      if (!existing) {
        await this.record(
          tx,
          actor,
          ip,
          "catalog.amenity.created",
          "amenity",
          `${input.scope}:${slug}`,
          {
            name: input.name,
          },
        );
      }
      return { slug: a.slug, name: a.name, group: a.groupName };
    });
  }

  // ─── Destinations ─────────────────────────────────────────────────────────

  async listDestinations(): Promise<AdminDestination[]> {
    const rows = await this.db.destination.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        _count: { select: { hotels: true, tours: true } },
        hero: { select: { storageKey: true, altText: true } },
      },
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
      hero: this.heroRef(d.hero),
      updatedAt: d.updatedAt.toISOString(),
    }));
  }

  async createDestination(input: CreateDestination, actor: AuthContext, ip: string | null) {
    try {
      await this.db.$transaction(async (tx) => {
        const { heroMedia, ...fields } = input;
        await tx.destination.create({
          data: { ...fields, nameBn: fields.nameBn ?? null, ...(await this.heroId(tx, heroMedia)) },
        });
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
      const { heroMedia, ...fields } = input;
      await tx.destination.update({
        where: { id: found.id },
        data: { ...fields, nameBn: fields.nameBn ?? null, ...(await this.heroId(tx, heroMedia)) },
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
        partner: { select: { publicId: true, name: true } },
        hero: { select: { storageKey: true, altText: true } },
        gallery: GALLERY,
        amenities: { select: { amenity: { select: { slug: true } } } },
        rooms: {
          orderBy: [{ isActive: "desc" }, { maxAdults: "asc" }, { name: "asc" }],
          include: {
            gallery: GALLERY,
            amenities: { select: { amenity: { select: { slug: true } } } },
          },
        },
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
      supplier: h.partner ? { id: h.partner.publicId, name: h.partner.name } : null,
      hero: this.heroRef(h.hero),
      propertyType: PROPERTY_TYPES.find((x) => x === h.propertyType) ?? null,
      distanceFromCity: h.distanceFromCity,
      distanceFromSpot: h.distanceFromSpot,
      childPolicy: h.childPolicy,
      petPolicy: h.petPolicy,
      houseRules: h.houseRules,
      breakfast: h.breakfast,
      specialNote: h.specialNote,
      nearbyPlaces: stringArray(h.nearbyPlaces),
      gallery: this.galleryRefs(h.gallery),
      amenities: h.amenities.map((a) => a.amenity.slug),
      rooms: h.rooms.map((r) => this.adminRoom(r)),
    };
  }

  async createHotel(input: CreateHotel, actor: AuthContext, ip: string | null) {
    const { destinationSlug, supplierId, heroMedia, gallery, amenities, ...fields } = input;
    try {
      await this.db.$transaction(async (tx) => {
        const destinationId = await this.destinationId(tx, destinationSlug);
        const created = await tx.hotel.create({
          data: {
            ...fields,
            publicId: newPublicId(),
            destinationId,
            partnerId: await this.supplierId(tx, supplierId),
            ...(await this.heroId(tx, heroMedia)),
            nameBn: fields.nameBn ?? null,
            description: fields.description ?? null,
          },
        });
        await this.setGallery(tx, "hotel", created.id, gallery);
        await this.setAmenities(tx, "hotel", created.id, amenities);
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
    const { destinationSlug, supplierId, heroMedia, gallery, amenities, ...fields } = input;
    await this.db.$transaction(async (tx) => {
      const found = await tx.hotel.findUnique({ where: { slug } });
      if (!found) throw notFound("hotel");
      const destinationId = await this.destinationId(tx, destinationSlug);
      await tx.hotel.update({
        where: { id: found.id },
        data: {
          ...fields,
          destinationId,
          ...(supplierId !== undefined ? { partnerId: await this.supplierId(tx, supplierId) } : {}),
          ...(await this.heroId(tx, heroMedia)),
          nameBn: fields.nameBn ?? null,
          description: fields.description ?? null,
        },
      });
      await this.setGallery(tx, "hotel", found.id, gallery);
      await this.setAmenities(tx, "hotel", found.id, amenities);
      await this.record(tx, actor, ip, "catalog.hotel.updated", "hotel", slug, {
        changed: [
          ...changedKeys(found, { ...fields, destinationId }),
          ...(gallery !== undefined ? ["gallery"] : []),
          ...(amenities !== undefined ? ["amenities"] : []),
        ],
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
        const { gallery, amenities, airConditioned, ...rest } = input;
        const fields = { ...rest, ...airConditionedField(airConditioned) };
        const room = await tx.hotelRoom.create({
          data: { ...fields, publicId: newPublicId(), hotelId: hotel.id },
        });
        await this.setGallery(tx, "room", room.id, gallery);
        await this.setAmenities(tx, "room", room.id, amenities);
        await this.record(tx, actor, ip, "catalog.room.created", "room", room.publicId, {
          hotel: hotelSlug,
          name: input.name,
        });
        return this.adminRoom(await this.roomWithMedia(tx, room.id));
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
        const { gallery, amenities, airConditioned, ...rest } = input;
        const fields = { ...rest, ...airConditionedField(airConditioned) };
        await tx.hotelRoom.update({ where: { id: found.id }, data: fields });
        await this.setGallery(tx, "room", found.id, gallery);
        await this.setAmenities(tx, "room", found.id, amenities);
        await this.record(tx, actor, ip, "catalog.room.updated", "room", roomId, {
          changed: [
            ...changedKeys(found, fields),
            ...(gallery !== undefined ? ["gallery"] : []),
            ...(amenities !== undefined ? ["amenities"] : []),
          ],
        });
        return this.adminRoom(await this.roomWithMedia(tx, found.id));
      });
    } catch (error) {
      if (uniqueViolation(error)) throw roomNameTaken();
      throw error;
    }
  }

  private roomWithMedia(tx: Tx, id: bigint) {
    return tx.hotelRoom.findUniqueOrThrow({
      where: { id },
      include: { gallery: GALLERY, amenities: { select: { amenity: { select: { slug: true } } } } },
    });
  }

  private adminRoom(r: RoomWithMedia): AdminRoom {
    return {
      id: r.publicId,
      name: r.name,
      description: r.description,
      maxAdults: r.maxAdults,
      maxChildren: r.maxChildren,
      bedType: r.bedType,
      sizeSqm: r.sizeSqm,
      isActive: r.isActive,
      roomType: r.roomType,
      details: r.details,
      airConditioned: r.airConditioned,
      extraBeds: r.extraBeds,
      rackRate: r.rackRateMinor !== null ? toMoney(r.rackRateMinor, "BDT") : null,
      discountRate: r.discountRateMinor !== null ? toMoney(r.discountRateMinor, "BDT") : null,
      units: r.units,
      gallery: this.galleryRefs(r.gallery),
      amenities: r.amenities.map((a) => a.amenity.slug),
    };
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
        partner: { select: { publicId: true, name: true } },
        hero: { select: { storageKey: true, altText: true } },
        schedules: { orderBy: { departsAt: "asc" } },
        gallery: GALLERY,
        amenities: { select: { amenity: { select: { slug: true } } } },
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
      supplier: t.partner ? { id: t.partner.publicId, name: t.partner.name } : null,
      hero: this.heroRef(t.hero),
      tourType: t.tourType,
      overview: t.overview,
      itinerary: t.itinerary,
      policy: t.policy,
      cancellationPolicy: t.cancellationPolicy,
      travelTips: t.travelTips,
      additionalInfo: t.additionalInfo,
      timing: t.timing,
      transport: t.transport,
      pickupPoints: list(t.pickupPoints),
      tags: list(t.tags),
      minAdults: t.minAdults,
      listPrice: t.listPriceMinor !== null ? toMoney(t.listPriceMinor, t.currency) : null,
      salePrice: t.salePriceMinor !== null ? toMoney(t.salePriceMinor, t.currency) : null,
      gallery: this.galleryRefs(t.gallery),
      amenities: t.amenities.map((a) => a.amenity.slug),
      departures: t.schedules.map(toAdminDeparture),
    };
  }

  async createTour(input: CreateTour, actor: AuthContext, ip: string | null) {
    const { destinationSlug, supplierId, heroMedia, gallery, amenities, ...fields } = input;
    try {
      await this.db.$transaction(async (tx) => {
        const destinationId = await this.destinationId(tx, destinationSlug);
        const created = await tx.tour.create({
          data: {
            ...fields,
            publicId: newPublicId(),
            destinationId,
            partnerId: await this.supplierId(tx, supplierId),
            ...(await this.heroId(tx, heroMedia)),
            titleBn: fields.titleBn ?? null,
          },
        });
        await this.setGallery(tx, "tour", created.id, gallery);
        await this.setAmenities(tx, "tour", created.id, amenities);
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
    const { destinationSlug, supplierId, heroMedia, gallery, amenities, ...fields } = input;
    await this.db.$transaction(async (tx) => {
      const found = await tx.tour.findUnique({ where: { slug } });
      if (!found) throw notFound("tour");
      const destinationId = await this.destinationId(tx, destinationSlug);
      await tx.tour.update({
        where: { id: found.id },
        data: {
          ...fields,
          destinationId,
          ...(supplierId !== undefined ? { partnerId: await this.supplierId(tx, supplierId) } : {}),
          ...(await this.heroId(tx, heroMedia)),
          titleBn: fields.titleBn ?? null,
        },
      });
      await this.setGallery(tx, "tour", found.id, gallery);
      await this.setAmenities(tx, "tour", found.id, amenities);
      await this.record(tx, actor, ip, "catalog.tour.updated", "tour", slug, {
        changed: [
          ...changedKeys(found, { ...fields, destinationId }),
          ...(gallery !== undefined ? ["gallery"] : []),
          ...(amenities !== undefined ? ["amenities"] : []),
        ],
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

  /** Supplier public id → internal id (must be an active SUPPLIER partner); null clears it. */
  private async supplierId(
    tx: Pick<Tx, "partner">,
    publicId: string | null | undefined,
  ): Promise<bigint | null> {
    if (!publicId) return null;
    const p = await tx.partner.findUnique({
      where: { publicId },
      select: { id: true, kind: true },
    });
    if (!p || p.kind !== "SUPPLIER") {
      throw new ProblemException(
        422,
        "unknown-supplier",
        "Unknown supplier",
        "Choose an existing supplier partner.",
      );
    }
    return p.id;
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
        actorType: actor.kind === "PARTNER" ? "PARTNER" : "STAFF",
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
