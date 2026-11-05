import { z } from "zod";
import { BdPhoneSchema, EmailSchema } from "./auth";
import { EmailLogItemSchema, RefundViewSchema } from "./account";
import { PaymentViewSchema } from "./payment";
import {
  CalendarDateSchema,
  InstantSchema,
  MoneySchema,
  PromoCodeSchema,
  PublicIdSchema,
  nullableText,
} from "./common";

/**
 * Booking lifecycle (docs/database/DATABASE_DESIGN.md). The allowed
 * transitions are a business rule and live only in the API's state machine.
 */
export const BOOKING_STATUSES = [
  "DRAFT",
  "PENDING_AVAILABILITY",
  "PENDING_PAYMENT",
  "PAYMENT_PROCESSING",
  "CONFIRMED",
  "COMPLETED",
  "FAILED",
  "EXPIRED",
  "MANUAL_REVIEW",
  "CANCELLATION_REQUESTED",
  "CANCELLED",
  "REFUND_PENDING",
  "REFUNDED",
] as const;
export const BookingStatusSchema = z.enum(BOOKING_STATUSES);
export type BookingStatus = z.infer<typeof BookingStatusSchema>;

export const ProductTypeSchema = z.enum(["HOTEL", "TOUR"]);
export type ProductType = z.infer<typeof ProductTypeSchema>;

export const BookingSummarySchema = z
  .object({
    id: PublicIdSchema,
    reference: z.string(),
    status: BookingStatusSchema,
    productType: ProductTypeSchema,
    productName: z.string(),
    startDate: CalendarDateSchema,
    endDate: CalendarDateSchema.nullable(),
    guests: z.number().int(),
    total: MoneySchema,
    contactName: z.string(),
    createdAt: InstantSchema,
  })
  .meta({ id: "BookingSummary" });
export type BookingSummary = z.infer<typeof BookingSummarySchema>;

export const BookingStatusChangeSchema = z
  .object({
    from: BookingStatusSchema.nullable(),
    to: BookingStatusSchema,
    actorType: z.enum(["CUSTOMER", "STAFF", "SYSTEM", "PAYMENT_PROVIDER", "PARTNER"]),
    reason: nullableText(),
    at: InstantSchema,
  })
  .meta({ id: "BookingStatusChange" });

export const AdminBookingListQuerySchema = z.object({
  status: BookingStatusSchema.optional(),
  productType: ProductTypeSchema.optional(),
  q: z.string().trim().max(80).optional(),
  /** Bookings of one customer (public id). */
  customerId: PublicIdSchema.optional(),
  /** Bookings of one hotel or tour (slug). */
  hotel: z.string().max(80).optional(),
  tour: z.string().max(80).optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type AdminBookingListQuery = z.infer<typeof AdminBookingListQuerySchema>;

export const BookingListResponseSchema = z.object({
  items: z.array(BookingSummarySchema),
  nextCursor: nullableText(),
});

export const BookingStatusTransitionRequestSchema = z.object({
  to: BookingStatusSchema,
  /** Manual changes are audited and always need a human-readable reason. */
  reason: z.string().trim().min(5).max(500),
  /** Optimistic concurrency: the status the operator saw. */
  expectedStatus: BookingStatusSchema,
});
export type BookingStatusTransitionRequest = z.infer<typeof BookingStatusTransitionRequestSchema>;

// ─── Phase 4: quotes and booking creation ───────────────────────────────────

/** Server-computed price of a booking or quote. */
export const PriceBreakdownSchema = z
  .object({
    base: MoneySchema,
    /** Promotion discount on the base (service charge and VAT apply after it). */
    discount: MoneySchema,
    serviceCharge: MoneySchema,
    vat: MoneySchema,
    total: MoneySchema,
  })
  .meta({ id: "PriceBreakdown" });
export type PriceBreakdown = z.infer<typeof PriceBreakdownSchema>;

export const GuestAgeGroupSchema = z.enum(["ADULT", "CHILD"]);

export const BookingContactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: EmailSchema,
  phone: BdPhoneSchema,
});
export type BookingContact = z.infer<typeof BookingContactSchema>;

export const GuestInputSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  ageGroup: GuestAgeGroupSchema,
});
export type GuestInput = z.infer<typeof GuestInputSchema>;

const partyRefine = <T extends { adults: number; children: number; guests: GuestInput[] }>(
  value: T,
  ctx: z.RefinementCtx,
) => {
  const adults = value.guests.filter((g) => g.ageGroup === "ADULT").length;
  const children = value.guests.length - adults;
  if (adults !== value.adults || children !== value.children) {
    ctx.addIssue({
      code: "custom",
      path: ["guests"],
      message: "List every traveller once: adult and child counts must match the party.",
    });
  }
  if (value.guests[0]?.ageGroup !== "ADULT") {
    ctx.addIssue({
      code: "custom",
      path: ["guests", 0],
      message: "The first traveller is the lead guest and must be an adult.",
    });
  }
};

export const HotelQuoteQuerySchema = z
  .object({
    roomId: PublicIdSchema,
    promoCode: PromoCodeSchema.optional(),
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
export type HotelQuoteQuery = z.infer<typeof HotelQuoteQuerySchema>;

export const TourQuoteQuerySchema = z.object({
  departureId: PublicIdSchema,
  promoCode: PromoCodeSchema.optional(),
  adults: z.coerce.number().int().min(1).max(30).default(2),
  children: z.coerce.number().int().min(0).max(30).default(0),
});
export type TourQuoteQuery = z.infer<typeof TourQuoteQuerySchema>;

/**
 * What a booking would cost right now. Indicative: booking creation re-reads
 * inventory and rates under a row lock and rejects the request with
 * `409 price-changed` if the total differs from `expectedTotal`.
 */
export const QuoteSchema = z.object({
  product: ProductTypeSchema,
  productName: z.string(),
  productSlug: z.string(),
  /** Room type name, or the departure label for tours. */
  optionName: z.string(),
  startDate: CalendarDateSchema,
  endDate: CalendarDateSchema.nullable(),
  nights: z.number().int().nullable(),
  rooms: z.number().int().nullable(),
  adults: z.number().int(),
  children: z.number().int(),
  available: z.boolean(),
  /** Rooms or seats still free (null when unavailable for another reason). */
  left: z.number().int().nullable(),
  unavailableReason: z
    .enum(["occupancy", "no-inventory", "sold-out", "no-rate", "currency", "closed", "departed"])
    .nullable(),
  price: PriceBreakdownSchema.nullable(),
  cancellationPolicy: nullableText(),
  /** The promotion applied to `price`, if a valid code was given. */
  promotion: z.object({ code: z.string(), name: z.string() }).nullable(),
  /** Why a given code did not apply (the price is then without discount). */
  promoError: nullableText(200),
  pricedAt: InstantSchema,
});
export type Quote = z.infer<typeof QuoteSchema>;

export const CreateHotelBookingRequestSchema = z
  .object({
    product: z.literal("HOTEL"),
    roomId: PublicIdSchema,
    checkIn: CalendarDateSchema,
    checkOut: CalendarDateSchema,
    rooms: z.number().int().min(1).max(9),
    adults: z.number().int().min(1).max(36),
    children: z.number().int().min(0).max(18),
    contact: BookingContactSchema,
    guests: z.array(GuestInputSchema).min(1).max(54),
    /** The total the customer was shown; a mismatch answers 409 price-changed. */
    expectedTotal: MoneySchema,
    /** Optional coupon; the expected total already includes its discount. */
    promoCode: PromoCodeSchema.optional(),
  })
  .superRefine((v, ctx) => {
    if (v.checkOut <= v.checkIn) {
      ctx.addIssue({
        code: "custom",
        path: ["checkOut"],
        message: "Check-out must be after check-in",
      });
    }
    partyRefine(v, ctx);
  });

export const CreateTourBookingRequestSchema = z
  .object({
    product: z.literal("TOUR"),
    departureId: PublicIdSchema,
    adults: z.number().int().min(1).max(30),
    children: z.number().int().min(0).max(30),
    contact: BookingContactSchema,
    guests: z.array(GuestInputSchema).min(1).max(60),
    expectedTotal: MoneySchema,
    /** Optional coupon; the expected total already includes its discount. */
    promoCode: PromoCodeSchema.optional(),
  })
  .superRefine(partyRefine);

/** POST /bookings — requires a customer session, CSRF and an `Idempotency-Key` header. */
export const CreateBookingRequestSchema = z.discriminatedUnion("product", [
  CreateHotelBookingRequestSchema,
  CreateTourBookingRequestSchema,
]);
export type CreateBookingRequest = z.infer<typeof CreateBookingRequestSchema>;

export const IDEMPOTENCY_HEADER = "idempotency-key";
/** Client-generated, 16–128 visible ASCII characters (a UUID is ideal). */
export const IdempotencyKeySchema = z.string().regex(/^[\x21-\x7E]{16,128}$/);

export const CancelBookingRequestSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const BookingItemViewSchema = z
  .object({
    type: z.enum(["HOTEL_ROOM", "TOUR_SEAT"]),
    description: z.string(),
    quantity: z.number().int(),
    amount: MoneySchema,
  })
  .meta({ id: "BookingItem" });

export const BookingGuestViewSchema = z
  .object({ fullName: z.string(), ageGroup: GuestAgeGroupSchema, isLead: z.boolean() })
  .meta({ id: "BookingGuest" });

export const BookingDetailSchema = BookingSummarySchema.extend({
  contactEmail: z.string(),
  contactPhone: z.string(),
  /** While PENDING_PAYMENT, inventory is held until this instant. */
  holdExpiresAt: InstantSchema.nullable(),
  price: PriceBreakdownSchema,
  items: z.array(BookingItemViewSchema),
  /** Named travellers; the lead guest comes first. (`guests` is the head count.) */
  travellers: z.array(BookingGuestViewSchema),
  history: z.array(BookingStatusChangeSchema),
  allowedTransitions: z.array(BookingStatusSchema),
  /** Travel agent that booked for the client, and its commission. */
  agent: z.object({ name: z.string(), commission: MoneySchema }).nullable(),
  /** Coupon used for this booking, if any. */
  promotionCode: nullableText(40),
  /** Payment attempts, newest first. */
  payments: z.array(PaymentViewSchema),
  /** True when online payment is enabled and this booking can be paid now. */
  canPay: z.boolean(),
  /** The account that made the booking. */
  customer: z.object({ id: PublicIdSchema, fullName: z.string(), email: z.string() }),
  /** What was booked, for linking to the hotel/tour (and departure). */
  product: z.object({
    type: ProductTypeSchema,
    slug: z.string(),
    departureId: PublicIdSchema.nullable(),
    /** Hotel address or tour meeting point (voucher). */
    location: nullableText(255),
    checkInTime: nullableText(5),
    checkOutTime: nullableText(5),
    cancellationPolicy: nullableText(500),
  }),
  refunds: z.array(RefundViewSchema),
  /** Transactional emails for this booking (staff views only). */
  emails: z.array(EmailLogItemSchema).optional(),
});
export type BookingDetail = z.infer<typeof BookingDetailSchema>;
