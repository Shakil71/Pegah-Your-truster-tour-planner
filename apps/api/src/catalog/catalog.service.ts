import { Inject, Injectable } from "@nestjs/common";
import type {
  DestinationDetail,
  DestinationSummary,
  HotelDetail,
  HotelOffersQuery,
  HotelOffersResponse,
  HotelOffer,
  HotelSearchQuery,
  HotelSearchResponse,
  HotelSummary,
  TourDetail,
  TourSummary,
} from "@pegah/contracts";
import type { Prisma } from "@pegah/db";
import { toMoney } from "../common/money";
import { ProblemException } from "../common/problem";
import { parseStay } from "../common/stay-dates";
import { stayNights } from "../common/time";
import { APP_CONFIG, type AppConfig } from "../config/config";
import { PRISMA, type Db } from "../prisma/prisma.service";
import { stringList, toHotelSummary, toMedia } from "./catalog.mappers";
import { evaluateRoom } from "./hotel-search";

const MEDIA_SELECT = {
  select: { storageKey: true, altText: true, credit: true, width: true, height: true },
} as const;
const UPCOMING_DEPARTURES = (now: Date) =>
  ({
    where: { status: "SCHEDULED", departsAt: { gt: now } },
    orderBy: { departsAt: "asc" },
  }) satisfies Prisma.Tour$schedulesArgs;

type TourRow = Prisma.TourGetPayload<{
  include: {
    destination: { select: { slug: true; name: true } };
    hero: typeof MEDIA_SELECT;
    schedules: true;
  };
}>;

/**
 * Public catalog reads. Only PUBLISHED records are visible, and every price
 * is computed here from rates in the database.
 */
@Injectable()
export class CatalogService {
  private readonly media: string;

  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(APP_CONFIG) config: AppConfig,
  ) {
    this.media = config.MEDIA_BASE_URL;
  }

  async listDestinations(): Promise<DestinationSummary[]> {
    const rows = await this.db.destination.findMany({
      where: { status: "PUBLISHED" },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        hero: MEDIA_SELECT,
        _count: {
          select: {
            hotels: { where: { status: "PUBLISHED" } },
            tours: { where: { status: "PUBLISHED" } },
          },
        },
      },
    });
    return rows.map((d) => ({
      slug: d.slug,
      name: d.name,
      nameBn: d.nameBn,
      region: d.region,
      summary: d.summary,
      hero: toMedia(d.hero, this.media),
      hotelCount: d._count.hotels,
      tourCount: d._count.tours,
    }));
  }

  async destination(slug: string, now: Date = new Date()): Promise<DestinationDetail> {
    const d = await this.db.destination.findFirst({
      where: { slug, status: "PUBLISHED" },
      include: {
        hero: MEDIA_SELECT,
        hotels: {
          where: { status: "PUBLISHED" },
          orderBy: { name: "asc" },
          include: { hero: MEDIA_SELECT },
        },
        tours: {
          where: { status: "PUBLISHED" },
          orderBy: { title: "asc" },
          include: { hero: MEDIA_SELECT, schedules: UPCOMING_DEPARTURES(now) },
        },
      },
    });
    if (!d) throw new ProblemException(404, "destination-not-found", "Destination not found");
    const ref = { slug: d.slug, name: d.name };
    return {
      slug: d.slug,
      name: d.name,
      nameBn: d.nameBn,
      region: d.region,
      summary: d.summary,
      hero: toMedia(d.hero, this.media),
      hotelCount: d.hotels.length,
      tourCount: d.tours.length,
      hotels: d.hotels.map((h) => toHotelSummary({ ...h, destination: ref }, this.media)),
      tours: d.tours.map((t) => this.toTourSummary({ ...t, destination: ref })),
    };
  }

  async hotel(slug: string): Promise<HotelDetail> {
    const h = await this.db.hotel.findFirst({
      where: { slug, status: "PUBLISHED", destination: { status: "PUBLISHED" } },
      include: {
        destination: { select: { slug: true, name: true } },
        hero: MEDIA_SELECT,
        rooms: { where: { isActive: true }, orderBy: { maxAdults: "asc" } },
      },
    });
    if (!h) throw new ProblemException(404, "hotel-not-found", "Hotel not found");
    return {
      ...toHotelSummary(h, this.media),
      description: h.description,
      addressLine: h.addressLine,
      checkInTime: h.checkInTime,
      checkOutTime: h.checkOutTime,
      cancellationPolicy: h.cancellationPolicy,
      rooms: h.rooms.map((r) => ({
        id: r.publicId,
        name: r.name,
        description: r.description,
        maxAdults: r.maxAdults,
        maxChildren: r.maxChildren,
        bedType: r.bedType,
        sizeSqm: r.sizeSqm,
      })),
    };
  }

  /**
   * Availability and price search. Results are indicative: the booking flow
   * re-reads inventory and rates under a row lock before holding anything.
   */
  async searchHotels(q: HotelSearchQuery, now: Date = new Date()): Promise<HotelSearchResponse> {
    const { checkIn, checkOut } = parseStay(q.checkIn, q.checkOut, now);

    const destination = await this.db.destination.findFirst({
      where: { slug: q.destination, status: "PUBLISHED" },
      select: { id: true },
    });
    if (!destination)
      throw new ProblemException(404, "destination-not-found", "Destination not found");

    const range = { gte: checkIn, lt: checkOut };
    const hotels = await this.db.hotel.findMany({
      where: { destinationId: destination.id, status: "PUBLISHED" },
      include: {
        destination: { select: { slug: true, name: true } },
        hero: MEDIA_SELECT,
        rooms: {
          where: { isActive: true },
          include: {
            inventory: { where: { stayDate: range } },
            rates: { where: { stayDate: range } },
          },
        },
      },
    });

    const nightDates = stayNights(checkIn, checkOut);
    const offers: HotelOffer[] = [];
    for (const hotel of hotels) {
      let best: HotelOffer | undefined;
      let bestTotal: bigint | undefined;
      for (const room of hotel.rooms) {
        const result = evaluateRoom(room, {
          nights: nightDates,
          rooms: q.rooms,
          adults: q.adults,
          children: q.children,
          currency: hotel.currency,
          serviceChargeBps: hotel.serviceChargeBps,
          vatBps: hotel.vatBps,
        });
        if (!result.ok) continue;
        if (bestTotal !== undefined && result.price.totalMinor >= bestTotal) continue;
        bestTotal = result.price.totalMinor;
        const money = (v: bigint) => toMoney(v, hotel.currency);
        best = {
          hotel: toHotelSummary(hotel, this.media),
          room: {
            id: room.publicId,
            name: room.name,
            description: room.description,
            maxAdults: room.maxAdults,
            maxChildren: room.maxChildren,
            bedType: room.bedType,
            sizeSqm: room.sizeSqm,
          },
          roomsLeft: result.roomsLeft,
          price: {
            nights: result.price.nights,
            rooms: result.price.rooms,
            base: money(result.price.baseMinor),
            serviceCharge: money(result.price.serviceChargeMinor),
            vat: money(result.price.vatMinor),
            total: money(result.price.totalMinor),
            perNightFrom: money(result.price.perNightFromMinor),
          },
        };
      }
      if (best) offers.push(best);
    }
    offers.sort((a, b) => a.price.total.amountMinor - b.price.total.amountMinor);

    return {
      query: {
        destination: q.destination,
        checkIn: q.checkIn,
        checkOut: q.checkOut,
        adults: q.adults,
        children: q.children,
        rooms: q.rooms,
      },
      offers,
      pricedAt: now.toISOString(),
    };
  }

  /** Every active room of a hotel priced for one stay (property page). Indicative only. */
  async hotelOffers(
    slug: string,
    q: HotelOffersQuery,
    now: Date = new Date(),
  ): Promise<HotelOffersResponse> {
    const stay = parseStay(q.checkIn, q.checkOut, now);
    const range = { gte: stay.checkIn, lt: stay.checkOut };
    const hotel = await this.db.hotel.findFirst({
      where: { slug, status: "PUBLISHED", destination: { status: "PUBLISHED" } },
      include: {
        rooms: {
          where: { isActive: true },
          orderBy: { maxAdults: "asc" },
          include: {
            inventory: { where: { stayDate: range } },
            rates: { where: { stayDate: range } },
          },
        },
      },
    });
    if (!hotel) throw new ProblemException(404, "hotel-not-found", "Hotel not found");
    const nights = stayNights(stay.checkIn, stay.checkOut);
    const money = (v: bigint) => toMoney(v, hotel.currency);
    const rooms = hotel.rooms.map((room) => {
      const r = evaluateRoom(room, {
        nights,
        rooms: q.rooms,
        adults: q.adults,
        children: q.children,
        currency: hotel.currency,
        serviceChargeBps: hotel.serviceChargeBps,
        vatBps: hotel.vatBps,
      });
      return {
        room: {
          id: room.publicId,
          name: room.name,
          description: room.description,
          maxAdults: room.maxAdults,
          maxChildren: room.maxChildren,
          bedType: room.bedType,
          sizeSqm: room.sizeSqm,
        },
        available: r.ok,
        roomsLeft: r.ok ? r.roomsLeft : null,
        reason: r.ok ? null : r.reason,
        price: r.ok
          ? {
              nights: r.price.nights,
              rooms: r.price.rooms,
              base: money(r.price.baseMinor),
              serviceCharge: money(r.price.serviceChargeMinor),
              vat: money(r.price.vatMinor),
              total: money(r.price.totalMinor),
              perNightFrom: money(r.price.perNightFromMinor),
            }
          : null,
      };
    });
    rooms.sort((a, b) =>
      a.available === b.available
        ? (a.price?.total.amountMinor ?? 0) - (b.price?.total.amountMinor ?? 0)
        : a.available
          ? -1
          : 1,
    );
    return { rooms, pricedAt: now.toISOString() };
  }

  /** Published hotels by slug, in the order given (home page features). */
  async hotelsBySlug(slugs: string[]): Promise<HotelSummary[]> {
    if (slugs.length === 0) return [];
    const rows = await this.db.hotel.findMany({
      where: { slug: { in: slugs }, status: "PUBLISHED", destination: { status: "PUBLISHED" } },
      include: { destination: { select: { slug: true, name: true } }, hero: MEDIA_SELECT },
    });
    const bySlug = new Map(rows.map((h) => [h.slug, toHotelSummary(h, this.media)]));
    return slugs.flatMap((slug) => bySlug.get(slug) ?? []);
  }

  async listTours(now: Date = new Date()): Promise<TourSummary[]> {
    const rows = await this.db.tour.findMany({
      where: { status: "PUBLISHED", destination: { status: "PUBLISHED" } },
      orderBy: { title: "asc" },
      include: {
        destination: { select: { slug: true, name: true } },
        hero: MEDIA_SELECT,
        schedules: UPCOMING_DEPARTURES(now),
      },
    });
    return rows.map((t) => this.toTourSummary(t));
  }

  async tour(slug: string, now: Date = new Date()): Promise<TourDetail> {
    const t = await this.db.tour.findFirst({
      where: { slug, status: "PUBLISHED", destination: { status: "PUBLISHED" } },
      include: {
        destination: { select: { slug: true, name: true } },
        hero: MEDIA_SELECT,
        schedules: UPCOMING_DEPARTURES(now),
      },
    });
    if (!t) throw new ProblemException(404, "tour-not-found", "Tour not found");
    return {
      ...this.toTourSummary(t),
      description: t.description,
      meetingPoint: t.meetingPoint,
      groupSizeMax: t.groupSizeMax,
      highlights: stringList(t.highlights),
      includes: stringList(t.includes),
      excludes: stringList(t.excludes),
      departures: t.schedules.map((s) => ({
        id: s.publicId,
        departsAt: s.departsAt.toISOString(),
        returnsAt: s.returnsAt.toISOString(),
        seatsLeft: Math.max(0, s.capacity - s.held - s.sold),
        priceAdult: toMoney(s.priceAdultMinor, s.currency),
        priceChild: toMoney(s.priceChildMinor, s.currency),
        status: s.status,
      })),
    };
  }

  private toTourSummary(t: TourRow): TourSummary {
    const open = t.schedules.filter((s) => s.capacity - s.held - s.sold > 0);
    let from: { amount: bigint; currency: string } | null = null;
    for (const s of open) {
      if (!from || s.priceAdultMinor < from.amount) {
        from = { amount: s.priceAdultMinor, currency: s.currency };
      }
    }
    return {
      id: t.publicId,
      slug: t.slug,
      title: t.title,
      titleBn: t.titleBn,
      destination: { slug: t.destination.slug, name: t.destination.name },
      durationDays: t.durationDays,
      durationNights: t.durationNights,
      summary: t.summary,
      hero: toMedia(t.hero, this.media),
      fromPrice: from ? toMoney(from.amount, from.currency) : null,
      nextDepartureAt: open[0]?.departsAt.toISOString() ?? null,
    };
  }
}
