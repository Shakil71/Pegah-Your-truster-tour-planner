import { z } from "zod";
import { BookingSummarySchema } from "./booking";
import { HeroRefSchema, MediaKeySchema } from "./media";
import {
  CalendarDateSchema,
  InstantSchema,
  MoneySchema,
  PublicIdSchema,
  SlugSchema,
  nullableText,
} from "./common";

/**
 * Back-office catalog, inventory and customer contracts (Phase 6, ADR-0023).
 * Slugs are chosen at creation and never change, so public links and admin
 * links stay stable. Every mutation is audited by the API.
 */

export const PublishStatusSchema = z.enum(["DRAFT", "PUBLISHED", "SUSPENDED"]);
export type PublishStatus = z.infer<typeof PublishStatusSchema>;

const Text = (min: number, max: number) => z.string().trim().min(min).max(max);
const OptionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();
const Bps = z.number().int().min(0).max(3000);
const ClockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24-hour)");
const StringList = z.array(Text(1, 200)).max(20);

// ─── Destinations ───────────────────────────────────────────────────────────

export const DestinationInputSchema = z.object({
  name: Text(2, 120),
  nameBn: OptionalText(120),
  region: Text(2, 80),
  summary: Text(10, 500),
  status: PublishStatusSchema,
  sortOrder: z.number().int().min(0).max(9999),
  /** Main photo from the media library (key); null removes it, omitted keeps it. */
  heroMedia: MediaKeySchema.nullable().optional(),
});
export type DestinationInput = z.infer<typeof DestinationInputSchema>;
export const CreateDestinationSchema = DestinationInputSchema.extend({ slug: SlugSchema });
export type CreateDestination = z.infer<typeof CreateDestinationSchema>;

export const AdminDestinationSchema = z
  .object({
    slug: SlugSchema,
    name: z.string(),
    nameBn: nullableText(120),
    region: z.string(),
    summary: z.string(),
    status: PublishStatusSchema,
    sortOrder: z.number().int(),
    hotelCount: z.number().int(),
    tourCount: z.number().int(),
    hero: HeroRefSchema.nullable(),
    updatedAt: InstantSchema,
  })
  .meta({ id: "AdminDestination" });
export type AdminDestination = z.infer<typeof AdminDestinationSchema>;

export const AdminDestinationListSchema = z.object({ items: z.array(AdminDestinationSchema) });

// ─── Hotels and rooms ───────────────────────────────────────────────────────

export const HotelInputSchema = z.object({
  destinationSlug: SlugSchema,
  name: Text(2, 160),
  nameBn: OptionalText(160),
  starRating: z.number().int().min(1).max(5).nullable(),
  addressLine: Text(3, 255),
  summary: Text(10, 500),
  description: OptionalText(5000),
  checkInTime: ClockTime,
  checkOutTime: ClockTime,
  cancellationPolicy: Text(10, 500),
  /** Service charge on the room base, basis points (1000 = 10%). */
  serviceChargeBps: Bps,
  /** VAT on base + service charge, basis points (1500 = 15%). */
  vatBps: Bps,
  status: PublishStatusSchema,
  /** Supplier partner that manages this hotel in the partner portal. */
  supplierId: PublicIdSchema.nullable().optional(),
  /** Main photo from the media library (key); null removes it, omitted keeps it. */
  heroMedia: MediaKeySchema.nullable().optional(),
});
export type HotelInput = z.infer<typeof HotelInputSchema>;
export const CreateHotelSchema = HotelInputSchema.extend({ slug: SlugSchema });
export type CreateHotel = z.infer<typeof CreateHotelSchema>;

export const RoomInputSchema = z.object({
  name: Text(2, 120),
  description: Text(2, 500),
  maxAdults: z.number().int().min(1).max(10),
  maxChildren: z.number().int().min(0).max(10),
  bedType: Text(2, 60),
  sizeSqm: z.number().int().min(5).max(2000).nullable(),
  isActive: z.boolean(),
});
export type RoomInput = z.infer<typeof RoomInputSchema>;

export const AdminRoomSchema = RoomInputSchema.extend({ id: PublicIdSchema }).meta({
  id: "AdminRoom",
});
export type AdminRoom = z.infer<typeof AdminRoomSchema>;

export const AdminHotelSummarySchema = z
  .object({
    id: PublicIdSchema,
    slug: SlugSchema,
    name: z.string(),
    destination: z.object({ slug: SlugSchema, name: z.string() }),
    starRating: z.number().int().nullable(),
    status: PublishStatusSchema,
    roomCount: z.number().int(),
    activeBookings: z.number().int(),
    updatedAt: InstantSchema,
  })
  .meta({ id: "AdminHotelSummary" });
export type AdminHotelSummary = z.infer<typeof AdminHotelSummarySchema>;

export const AdminHotelListSchema = z.object({ items: z.array(AdminHotelSummarySchema) });

export const AdminHotelDetailSchema = AdminHotelSummarySchema.extend({
  nameBn: nullableText(160),
  addressLine: z.string(),
  summary: z.string(),
  description: nullableText(5000),
  checkInTime: z.string(),
  checkOutTime: z.string(),
  cancellationPolicy: z.string(),
  serviceChargeBps: z.number().int(),
  vatBps: z.number().int(),
  supplier: z.object({ id: PublicIdSchema, name: z.string() }).nullable(),
  hero: HeroRefSchema.nullable(),
  rooms: z.array(AdminRoomSchema),
});
export type AdminHotelDetail = z.infer<typeof AdminHotelDetailSchema>;

// ─── Inventory and rate calendar ────────────────────────────────────────────

export const CalendarQuerySchema = z.object({
  from: CalendarDateSchema,
  days: z.coerce.number().int().min(1).max(62).default(31),
});
export type CalendarQuery = z.infer<typeof CalendarQuerySchema>;

export const CalendarDaySchema = z
  .object({
    date: CalendarDateSchema,
    total: z.number().int().nullable(),
    held: z.number().int(),
    sold: z.number().int(),
    rate: MoneySchema.nullable(),
  })
  .meta({ id: "CalendarDay" });

export const RoomCalendarSchema = z.object({
  room: z.object({ id: PublicIdSchema, name: z.string() }),
  hotel: z.object({ slug: SlugSchema, name: z.string(), currency: z.string() }),
  days: z.array(CalendarDaySchema),
});
export type RoomCalendar = z.infer<typeof RoomCalendarSchema>;

/**
 * Sets rooms on sale and/or the nightly rate for every date in [from, to]
 * (inclusive), optionally only on some weekdays (0 = Sunday … 6 = Saturday).
 * Rejected with 409 if `total` would drop below rooms already held or sold.
 */
export const CalendarUpdateSchema = z
  .object({
    from: CalendarDateSchema,
    to: CalendarDateSchema,
    weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7).optional(),
    total: z.number().int().min(0).max(500).optional(),
    rate: MoneySchema.refine((m) => m.amountMinor > 0, "Rate must be above zero").optional(),
  })
  .refine((v) => v.to >= v.from, { message: "End date must not be before start", path: ["to"] })
  .refine((v) => v.total !== undefined || v.rate !== undefined, {
    message: "Set rooms on sale, a rate, or both",
    path: ["total"],
  });
export type CalendarUpdate = z.infer<typeof CalendarUpdateSchema>;

export const CalendarUpdateResultSchema = z.object({ datesUpdated: z.number().int() });

// ─── Tours and departures ───────────────────────────────────────────────────

export const TourInputSchema = z.object({
  destinationSlug: SlugSchema,
  title: Text(2, 160),
  titleBn: OptionalText(160),
  summary: Text(10, 500),
  description: Text(10, 10000),
  durationDays: z.number().int().min(1).max(60),
  durationNights: z.number().int().min(0).max(60),
  meetingPoint: Text(2, 255),
  groupSizeMax: z.number().int().min(1).max(500),
  highlights: StringList,
  includes: StringList,
  excludes: StringList,
  vatBps: Bps,
  status: PublishStatusSchema,
  supplierId: PublicIdSchema.nullable().optional(),
  heroMedia: MediaKeySchema.nullable().optional(),
});
export type TourInput = z.infer<typeof TourInputSchema>;
export const CreateTourSchema = TourInputSchema.extend({ slug: SlugSchema });
export type CreateTour = z.infer<typeof CreateTourSchema>;

export const AdminDepartureSchema = z
  .object({
    id: PublicIdSchema,
    departsAt: InstantSchema,
    returnsAt: InstantSchema,
    capacity: z.number().int(),
    held: z.number().int(),
    sold: z.number().int(),
    priceAdult: MoneySchema,
    priceChild: MoneySchema,
    status: z.enum(["SCHEDULED", "CLOSED", "CANCELLED"]),
  })
  .meta({ id: "AdminDeparture" });
export type AdminDeparture = z.infer<typeof AdminDepartureSchema>;

export const AdminTourSummarySchema = z
  .object({
    id: PublicIdSchema,
    slug: SlugSchema,
    title: z.string(),
    destination: z.object({ slug: SlugSchema, name: z.string() }),
    status: PublishStatusSchema,
    durationDays: z.number().int(),
    upcomingDepartures: z.number().int(),
    activeBookings: z.number().int(),
    updatedAt: InstantSchema,
  })
  .meta({ id: "AdminTourSummary" });
export type AdminTourSummary = z.infer<typeof AdminTourSummarySchema>;

export const AdminTourListSchema = z.object({ items: z.array(AdminTourSummarySchema) });

export const AdminTourDetailSchema = AdminTourSummarySchema.extend({
  titleBn: nullableText(160),
  summary: z.string(),
  description: z.string(),
  durationNights: z.number().int(),
  meetingPoint: z.string(),
  groupSizeMax: z.number().int(),
  highlights: z.array(z.string()),
  includes: z.array(z.string()),
  excludes: z.array(z.string()),
  vatBps: z.number().int(),
  supplier: z.object({ id: PublicIdSchema, name: z.string() }).nullable(),
  hero: HeroRefSchema.nullable(),
  departures: z.array(AdminDepartureSchema),
});
export type AdminTourDetail = z.infer<typeof AdminTourDetailSchema>;

const PositiveMoney = MoneySchema.refine((m) => m.amountMinor > 0, "Price must be above zero");

export const CreateDepartureSchema = z
  .object({
    departsAt: InstantSchema,
    returnsAt: InstantSchema,
    capacity: z.number().int().min(1).max(500),
    priceAdult: PositiveMoney,
    priceChild: MoneySchema,
  })
  .refine((v) => v.returnsAt > v.departsAt, {
    message: "Return must be after departure",
    path: ["returnsAt"],
  });
export type CreateDeparture = z.infer<typeof CreateDepartureSchema>;

/** Price changes apply to new bookings only; existing bookings keep their price snapshot. */
export const UpdateDepartureSchema = z
  .object({
    capacity: z.number().int().min(0).max(500).optional(),
    priceAdult: PositiveMoney.optional(),
    priceChild: MoneySchema.optional(),
    status: z.enum(["SCHEDULED", "CLOSED", "CANCELLED"]).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: "Nothing to change" });
export type UpdateDeparture = z.infer<typeof UpdateDepartureSchema>;

// ─── Customers ──────────────────────────────────────────────────────────────

export const CustomerListQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
export type CustomerListQuery = z.infer<typeof CustomerListQuerySchema>;

export const AdminCustomerSchema = z
  .object({
    id: PublicIdSchema,
    email: z.string(),
    fullName: z.string(),
    phone: nullableText(20),
    status: z.enum(["ACTIVE", "DISABLED"]),
    emailVerified: z.boolean(),
    bookingCount: z.number().int(),
    lastLoginAt: InstantSchema.nullable(),
    createdAt: InstantSchema,
  })
  .meta({ id: "AdminCustomer" });
export type AdminCustomer = z.infer<typeof AdminCustomerSchema>;

export const CustomerListSchema = z.object({
  items: z.array(AdminCustomerSchema),
  nextCursor: nullableText(200),
});
export type CustomerList = z.infer<typeof CustomerListSchema>;

export const CustomerDetailSchema = AdminCustomerSchema.extend({
  /** Confirmed or completed bookings' total value, BDT. */
  lifetimeValue: MoneySchema,
  bookings: z.array(BookingSummarySchema),
});
export type CustomerDetail = z.infer<typeof CustomerDetailSchema>;

/** Disable or re-enable a customer account. Disabling signs them out everywhere. */
export const CustomerStatusUpdateSchema = z.object({
  status: z.enum(["ACTIVE", "DISABLED"]),
  /** Why, for the audit log (required when disabling). */
  reason: z.string().trim().max(300).optional(),
});
export type CustomerStatusUpdate = z.infer<typeof CustomerStatusUpdateSchema>;

export const CustomerSignOutResultSchema = z.object({ sessionsEnded: z.number().int() });
