import { z } from "zod";
import { BookingStatusSchema, ProductTypeSchema } from "./booking";
import {
  CalendarDateSchema,
  InstantSchema,
  MoneySchema,
  PromoCodeSchema,
  PublicIdSchema,
  SlugSchema,
} from "./common";

/** Promotions, reports and content pages (Phase 6, ADR-0025). */

// ─── Promotions ─────────────────────────────────────────────────────────────

export const PromotionInputSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    kind: z.enum(["PERCENT", "FIXED"]),
    /** PERCENT: basis points of the base (1000 = 10%). */
    percentBps: z.number().int().min(1).max(10000).nullable(),
    /** FIXED: amount off the base. */
    amount: MoneySchema.nullable(),
    minSpend: MoneySchema,
    maxDiscount: MoneySchema.nullable(),
    scope: z.enum(["ALL", "HOTEL", "TOUR"]),
    startsAt: InstantSchema,
    endsAt: InstantSchema,
    maxRedemptions: z.number().int().min(1).max(1_000_000).nullable(),
    perCustomerLimit: z.number().int().min(1).max(100),
    status: z.enum(["ACTIVE", "PAUSED"]),
  })
  .refine(
    (v) =>
      v.kind === "PERCENT"
        ? v.percentBps !== null && v.amount === null
        : v.amount !== null && v.percentBps === null,
    {
      message: "Percent promotions need a percentage; fixed promotions need an amount",
      path: ["kind"],
    },
  )
  .refine((v) => v.endsAt > v.startsAt, { message: "End must be after start", path: ["endsAt"] });
export type PromotionInput = z.infer<typeof PromotionInputSchema>;

export const CreatePromotionSchema = z.object({
  code: PromoCodeSchema,
  promotion: PromotionInputSchema,
});
export type CreatePromotion = z.infer<typeof CreatePromotionSchema>;

export const PromotionViewSchema = z
  .object({
    id: PublicIdSchema,
    code: z.string(),
    name: z.string(),
    kind: z.enum(["PERCENT", "FIXED"]),
    percentBps: z.number().int().nullable(),
    amount: MoneySchema.nullable(),
    minSpend: MoneySchema,
    maxDiscount: MoneySchema.nullable(),
    scope: z.enum(["ALL", "HOTEL", "TOUR"]),
    startsAt: InstantSchema,
    endsAt: InstantSchema,
    maxRedemptions: z.number().int().nullable(),
    perCustomerLimit: z.number().int(),
    status: z.enum(["ACTIVE", "PAUSED"]),
    redemptions: z.number().int(),
    discountGiven: MoneySchema,
  })
  .meta({ id: "Promotion" });
export type PromotionView = z.infer<typeof PromotionViewSchema>;

export const PromotionListSchema = z.object({ items: z.array(PromotionViewSchema) });

// ─── Reports ────────────────────────────────────────────────────────────────

export const ReportQuerySchema = z
  .object({ from: CalendarDateSchema, to: CalendarDateSchema })
  .refine((v) => v.to >= v.from, { message: "End must not be before start", path: ["to"] });
export type ReportQuery = z.infer<typeof ReportQuerySchema>;

export const SalesReportSchema = z.object({
  from: CalendarDateSchema,
  to: CalendarDateSchema,
  totals: z.object({
    bookings: z.number().int(),
    confirmedBookings: z.number().int(),
    confirmedValue: MoneySchema,
    discounts: MoneySchema,
    refunded: MoneySchema,
    /** Confirmed value minus refunds paid in the period. */
    netRevenue: MoneySchema,
  }),
  byStatus: z.array(z.object({ status: BookingStatusSchema, count: z.number().int() })),
  byProduct: z.array(
    z.object({
      type: ProductTypeSchema,
      name: z.string(),
      bookings: z.number().int(),
      confirmedValue: MoneySchema,
    }),
  ),
  byDay: z.array(
    z.object({ date: CalendarDateSchema, bookings: z.number().int(), confirmedValue: MoneySchema }),
  ),
});
export type SalesReport = z.infer<typeof SalesReportSchema>;

// ─── Content pages ──────────────────────────────────────────────────────────

export const ContentPageInputSchema = z.object({
  title: z.string().trim().min(2).max(160),
  summary: z.string().trim().min(2).max(300),
  /** Plain text: blank lines separate paragraphs; lines starting "## " are headings. */
  body: z.string().trim().min(10).max(50_000),
  status: z.enum(["DRAFT", "PUBLISHED", "SUSPENDED"]),
});
export type ContentPageInput = z.infer<typeof ContentPageInputSchema>;
export const CreateContentPageSchema = ContentPageInputSchema.extend({ slug: SlugSchema });

export const ContentPageSchema = ContentPageInputSchema.extend({
  slug: SlugSchema,
  updatedAt: InstantSchema,
});
export type ContentPage = z.infer<typeof ContentPageSchema>;

export const ContentPageListSchema = z.object({
  items: z.array(
    z.object({
      slug: SlugSchema,
      title: z.string(),
      status: z.enum(["DRAFT", "PUBLISHED", "SUSPENDED"]),
      updatedAt: InstantSchema,
    }),
  ),
});

export const PublicContentPageSchema = z.object({
  slug: SlugSchema,
  title: z.string(),
  summary: z.string(),
  body: z.string(),
  updatedAt: InstantSchema,
});
