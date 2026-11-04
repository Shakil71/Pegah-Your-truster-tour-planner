import { z } from "zod";
import { CalendarDateSchema, InstantSchema, MoneySchema, PublicIdSchema } from "./common";

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
    actorType: z.enum(["CUSTOMER", "STAFF", "SYSTEM", "PAYMENT_PROVIDER"]),
    reason: z.string().nullable(),
    at: InstantSchema,
  })
  .meta({ id: "BookingStatusChange" });

export const AdminBookingListQuerySchema = z.object({
  status: BookingStatusSchema.optional(),
  productType: ProductTypeSchema.optional(),
  q: z.string().trim().max(80).optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type AdminBookingListQuery = z.infer<typeof AdminBookingListQuerySchema>;

export const BookingListResponseSchema = z.object({
  items: z.array(BookingSummarySchema),
  nextCursor: z.string().nullable(),
});

export const BookingStatusTransitionRequestSchema = z.object({
  to: BookingStatusSchema,
  /** Manual changes are audited and always need a human-readable reason. */
  reason: z.string().trim().min(5).max(500),
  /** Optimistic concurrency: the status the operator saw. */
  expectedStatus: BookingStatusSchema,
});
export type BookingStatusTransitionRequest = z.infer<typeof BookingStatusTransitionRequestSchema>;

export const BookingDetailSchema = BookingSummarySchema.extend({
  history: z.array(BookingStatusChangeSchema),
  allowedTransitions: z.array(BookingStatusSchema),
});
export type BookingDetail = z.infer<typeof BookingDetailSchema>;
