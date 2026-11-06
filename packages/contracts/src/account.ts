import { z } from "zod";
import { BdPhoneSchema, EmailSchema, PasswordSchema } from "./auth";
import {
  CalendarDateSchema,
  InstantSchema,
  MoneySchema,
  PublicIdSchema,
  nullableText,
} from "./common";

/** Customer account, saved travellers, password flows, cancellations and refunds (ADR-0024). */

// ─── Profile and password ───────────────────────────────────────────────────

export const ProfileSchema = z.object({
  id: PublicIdSchema,
  email: z.string(),
  fullName: z.string(),
  phone: nullableText(20),
  /** The customer opened the link sent to their email (ADR-0035). */
  emailVerified: z.boolean(),
  /** Language of emails to this customer (ADR-0036). */
  locale: z.enum(["en", "bn"]),
  createdAt: InstantSchema,
});
export type Profile = z.infer<typeof ProfileSchema>;

export const UpdateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: BdPhoneSchema.nullable(),
  /** Language of emails; left out = unchanged. */
  locale: z.enum(["en", "bn"]).optional(),
});
export type UpdateProfile = z.infer<typeof UpdateProfileSchema>;

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: PasswordSchema,
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: "Choose a password you have not used here",
    path: ["newPassword"],
  });
export type ChangePassword = z.infer<typeof ChangePasswordSchema>;

/** Always answered with 202, whether or not the email exists (no account probing). */
export const PasswordResetRequestSchema = z.object({ email: EmailSchema });
export const PasswordResetConfirmSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{32,128}$/),
  newPassword: PasswordSchema,
});
export type PasswordResetConfirm = z.infer<typeof PasswordResetConfirmSchema>;

// ─── Saved travellers ───────────────────────────────────────────────────────

export const TravellerInputSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  ageGroup: z.enum(["ADULT", "CHILD"]),
  dateOfBirth: CalendarDateSchema.nullable(),
  /** ISO 3166-1 alpha-2, e.g. "BD". */
  nationality: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "Use a two-letter country code, e.g. BD")
    .nullable(),
});
export type TravellerInput = z.infer<typeof TravellerInputSchema>;

export const TravellerSchema = TravellerInputSchema.extend({ id: PublicIdSchema }).meta({
  id: "Traveller",
});
export type Traveller = z.infer<typeof TravellerSchema>;
export const TravellerListSchema = z.object({ items: z.array(TravellerSchema) });

// ─── Cancellation and refunds ───────────────────────────────────────────────

export const CancellationRequestSchema = z.object({
  reason: z.string().trim().min(5).max(500),
});
export type CancellationRequest = z.infer<typeof CancellationRequestSchema>;

/**
 * Staff decision on a cancellation request. Approving cancels the booking,
 * releases its sold inventory and, when `refund` > 0, opens a refund for
 * finance. The refund may not exceed what was paid.
 */
export const CancellationDecisionSchema = z.object({
  approve: z.boolean(),
  refund: MoneySchema.optional(),
  reason: z.string().trim().min(5).max(500),
  expectedStatus: z.literal("CANCELLATION_REQUESTED"),
});
export type CancellationDecision = z.infer<typeof CancellationDecisionSchema>;

export const RefundViewSchema = z
  .object({
    id: PublicIdSchema,
    amount: MoneySchema,
    status: z.enum(["PENDING", "PAID"]),
    reason: z.string(),
    providerRef: nullableText(120),
    createdAt: InstantSchema,
    paidAt: InstantSchema.nullable(),
  })
  .meta({ id: "Refund" });
export type RefundView = z.infer<typeof RefundViewSchema>;

export const MarkRefundPaidSchema = z.object({
  providerRef: z.string().trim().min(3).max(120),
});

export const AdminRefundListQuerySchema = z.object({
  status: z.enum(["PENDING", "PAID"]).optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const AdminRefundListSchema = z.object({
  items: z.array(
    RefundViewSchema.extend({
      bookingId: PublicIdSchema,
      bookingReference: z.string(),
      customerName: z.string(),
    }),
  ),
  nextCursor: nullableText(200),
});

export const EmailLogItemSchema = z
  .object({
    template: z.string(),
    to: z.string(),
    subject: z.string(),
    status: z.enum(["QUEUED", "SENT", "FAILED", "SKIPPED"]),
    at: InstantSchema,
  })
  .meta({ id: "EmailLogItem" });

/** POST /auth/verify-email: the token from the link in the verification email. */
export const VerifyEmailSchema = z.object({ token: z.string().min(20).max(200) });
export type VerifyEmail = z.infer<typeof VerifyEmailSchema>;
