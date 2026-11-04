import { z } from "zod";
import {
  CalendarDateSchema,
  InstantSchema,
  MoneySchema,
  PublicIdSchema,
  SlugSchema,
  nullableText,
} from "./common";

export const MediaSchema = z
  .object({
    url: z.string(),
    alt: z.string(),
    credit: nullableText(),
    width: z.number().int().nullable(),
    height: z.number().int().nullable(),
  })
  .meta({ id: "Media" });

export const DestinationSummarySchema = z
  .object({
    slug: SlugSchema,
    name: z.string(),
    nameBn: nullableText(),
    region: z.string(),
    summary: z.string(),
    hero: MediaSchema.nullable(),
    hotelCount: z.number().int(),
    tourCount: z.number().int(),
  })
  .meta({ id: "DestinationSummary" });
export type DestinationSummary = z.infer<typeof DestinationSummarySchema>;

export const DestinationListResponseSchema = z.object({ items: z.array(DestinationSummarySchema) });

export const RoomSchema = z
  .object({
    id: PublicIdSchema,
    name: z.string(),
    description: z.string(),
    maxAdults: z.number().int(),
    maxChildren: z.number().int(),
    bedType: z.string(),
    sizeSqm: z.number().int().nullable(),
  })
  .meta({ id: "Room" });

export const HotelSummarySchema = z
  .object({
    id: PublicIdSchema,
    slug: SlugSchema,
    name: z.string(),
    nameBn: nullableText(),
    destination: z.object({ slug: SlugSchema, name: z.string() }),
    starRating: z.number().int().nullable(),
    summary: z.string(),
    hero: MediaSchema.nullable(),
  })
  .meta({ id: "HotelSummary" });
export type HotelSummary = z.infer<typeof HotelSummarySchema>;

export const HotelDetailSchema = HotelSummarySchema.extend({
  description: nullableText(),
  addressLine: z.string(),
  checkInTime: z.string(),
  checkOutTime: z.string(),
  cancellationPolicy: z.string(),
  rooms: z.array(RoomSchema),
});
export type HotelDetail = z.infer<typeof HotelDetailSchema>;

/**
 * Server-computed price breakdown. Clients display it; they never compute or
 * submit totals of their own.
 */
export const StayPriceSchema = z
  .object({
    nights: z.number().int(),
    rooms: z.number().int(),
    base: MoneySchema,
    serviceCharge: MoneySchema,
    vat: MoneySchema,
    total: MoneySchema,
    perNightFrom: MoneySchema,
  })
  .meta({ id: "StayPrice" });
export type StayPrice = z.infer<typeof StayPriceSchema>;

export const HotelSearchQuerySchema = z
  .object({
    destination: SlugSchema,
    checkIn: CalendarDateSchema,
    checkOut: CalendarDateSchema,
    adults: z.coerce.number().int().min(1).max(36).default(2),
    children: z.coerce.number().int().min(0).max(18).default(0),
    rooms: z.coerce.number().int().min(1).max(9).default(1),
  })
  .refine((q) => q.checkOut > q.checkIn, {
    message: "Check-out must be after check-in",
    path: ["checkOut"],
  });
export type HotelSearchQuery = z.infer<typeof HotelSearchQuerySchema>;

export const HotelOfferSchema = z
  .object({
    hotel: HotelSummarySchema,
    room: RoomSchema,
    roomsLeft: z.number().int(),
    price: StayPriceSchema,
  })
  .meta({ id: "HotelOffer" });
export type HotelOffer = z.infer<typeof HotelOfferSchema>;

export const HotelSearchResponseSchema = z.object({
  query: z.object({
    destination: SlugSchema,
    checkIn: CalendarDateSchema,
    checkOut: CalendarDateSchema,
    adults: z.number().int(),
    children: z.number().int(),
    rooms: z.number().int(),
  }),
  offers: z.array(HotelOfferSchema),
  /** Prices are indicative until revalidated at booking time. */
  pricedAt: InstantSchema,
});
export type HotelSearchResponse = z.infer<typeof HotelSearchResponseSchema>;

export const TourDepartureSchema = z
  .object({
    id: PublicIdSchema,
    departsAt: InstantSchema,
    returnsAt: InstantSchema,
    seatsLeft: z.number().int(),
    priceAdult: MoneySchema,
    priceChild: MoneySchema,
    status: z.enum(["SCHEDULED", "CLOSED", "CANCELLED"]),
  })
  .meta({ id: "TourDeparture" });

export const TourSummarySchema = z
  .object({
    id: PublicIdSchema,
    slug: SlugSchema,
    title: z.string(),
    titleBn: nullableText(),
    destination: z.object({ slug: SlugSchema, name: z.string() }),
    durationDays: z.number().int(),
    durationNights: z.number().int(),
    summary: z.string(),
    hero: MediaSchema.nullable(),
    fromPrice: MoneySchema.nullable(),
    nextDepartureAt: InstantSchema.nullable(),
  })
  .meta({ id: "TourSummary" });
export type TourSummary = z.infer<typeof TourSummarySchema>;

export const TourListResponseSchema = z.object({ items: z.array(TourSummarySchema) });

export const TourDetailSchema = TourSummarySchema.extend({
  description: z.string(),
  meetingPoint: z.string(),
  groupSizeMax: z.number().int(),
  highlights: z.array(z.string()),
  includes: z.array(z.string()),
  excludes: z.array(z.string()),
  departures: z.array(TourDepartureSchema),
});
export type TourDetail = z.infer<typeof TourDetailSchema>;

export const DestinationDetailSchema = DestinationSummarySchema.extend({
  hotels: z.array(HotelSummarySchema),
  tours: z.array(TourSummarySchema),
});
export type DestinationDetail = z.infer<typeof DestinationDetailSchema>;

export const HotelOffersQuerySchema = z
  .object({
    checkIn: CalendarDateSchema,
    checkOut: CalendarDateSchema,
    adults: z.coerce.number().int().min(1).max(36).default(2),
    children: z.coerce.number().int().min(0).max(18).default(0),
    rooms: z.coerce.number().int().min(1).max(9).default(1),
  })
  .refine((q) => q.checkOut > q.checkIn, {
    message: "Check-out must be after check-in",
    path: ["checkOut"],
  });
export type HotelOffersQuery = z.infer<typeof HotelOffersQuerySchema>;

export const HotelRoomOfferSchema = z
  .object({
    room: RoomSchema,
    available: z.boolean(),
    roomsLeft: z.number().int().nullable(),
    /** Why the room cannot be booked for this stay (null when available). */
    reason: z.enum(["occupancy", "no-inventory", "sold-out", "no-rate", "currency"]).nullable(),
    price: StayPriceSchema.nullable(),
  })
  .meta({ id: "HotelRoomOffer" });
export type HotelRoomOffer = z.infer<typeof HotelRoomOfferSchema>;

/** Every active room of one hotel priced for a stay (property page). */
export const HotelOffersResponseSchema = z.object({
  rooms: z.array(HotelRoomOfferSchema),
  pricedAt: InstantSchema,
});
export type HotelOffersResponse = z.infer<typeof HotelOffersResponseSchema>;
