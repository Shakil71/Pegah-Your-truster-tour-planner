import { z } from "zod";
import { InstantSchema, MoneySchema, PublicIdSchema, nullableText } from "./common";

/**
 * Hosted-payment contracts (ADR-0022). Card data never passes through Pegah:
 * the customer pays on the provider's page and the API verifies the outcome
 * server-to-server before a booking can be confirmed.
 */
export const PAYMENT_STATUSES = [
  "INITIATED",
  "PENDING",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
  "REFUND_REQUIRED",
] as const;
export const PaymentStatusSchema = z.enum(PAYMENT_STATUSES);
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

export const PaymentViewSchema = z
  .object({
    id: PublicIdSchema,
    provider: z.string(),
    status: PaymentStatusSchema,
    amount: MoneySchema,
    /** Card scheme or wallet (e.g. "VISA", "bKash"); never card numbers. */
    method: nullableText(60),
    failureReason: nullableText(255),
    createdAt: InstantSchema,
    succeededAt: InstantSchema.nullable(),
  })
  .meta({ id: "Payment" });
export type PaymentView = z.infer<typeof PaymentViewSchema>;

/** Returned by POST /me/bookings/{id}/payment-session. Send the browser to `redirectUrl`. */
export const PaymentSessionResponseSchema = z.object({
  paymentId: PublicIdSchema,
  provider: z.string(),
  mode: z.enum(["sandbox", "live", "simulator"]),
  redirectUrl: z.url(),
});
export type PaymentSessionResponse = z.infer<typeof PaymentSessionResponseSchema>;

export const AdminPaymentListQuerySchema = z.object({
  status: PaymentStatusSchema.optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type AdminPaymentListQuery = z.infer<typeof AdminPaymentListQuerySchema>;

export const AdminPaymentListResponseSchema = z.object({
  items: z.array(
    PaymentViewSchema.extend({
      /** Exactly one of bookingId / orderId is set (offers and gift cards are orders). */
      bookingId: PublicIdSchema.nullable(),
      orderId: PublicIdSchema.nullable(),
      /** Booking or order reference. */
      bookingReference: z.string(),
      providerTxnId: z.string(),
      bankTxnId: nullableText(80),
      riskLevel: z.number().int().nullable(),
    }),
  ),
  nextCursor: nullableText(200),
});
export type AdminPaymentListResponse = z.infer<typeof AdminPaymentListResponseSchema>;
