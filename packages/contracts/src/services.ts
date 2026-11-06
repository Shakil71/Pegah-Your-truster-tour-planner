import { z } from "zod";
import { BookingContactSchema } from "./booking";
import { MediaSchema } from "./catalog";
import {
  CalendarDateSchema,
  InstantSchema,
  MoneySchema,
  PublicIdSchema,
  SlugSchema,
  nullableText,
} from "./common";
import { HeroRefSchema, MediaKeySchema } from "./media";

/**
 * Visa services and flight requests (ADR-0039). Pegah staff handle every
 * request: they ask for documents, send a price, record the payment and
 * deliver. Nothing is confirmed automatically.
 */

const Text = (min: number, max: number) => z.string().trim().min(min).max(max);
const OptionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

export const ServiceKindSchema = z.enum(["VISA", "FLIGHT"]);
export type ServiceKind = z.infer<typeof ServiceKindSchema>;
export const ServiceStatusSchema = z.enum([
  "SUBMITTED",
  "NEEDS_INFO",
  "QUOTED",
  "PAID",
  "IN_PROGRESS",
  "COMPLETED",
  "REJECTED",
  "CANCELLED",
]);
export type ServiceStatus = z.infer<typeof ServiceStatusSchema>;

// ─── Visa products ──────────────────────────────────────────────────────────

export const VisaProductSummarySchema = z
  .object({
    slug: SlugSchema,
    country: z.string(),
    countryBn: nullableText(80),
    visaType: z.string(),
    summary: z.string(),
    processingTime: z.string(),
    validity: nullableText(80),
    fee: MoneySchema,
    hero: MediaSchema.nullable(),
  })
  .meta({ id: "VisaProductSummary" });
export type VisaProductSummary = z.infer<typeof VisaProductSummarySchema>;

export const VisaProductListSchema = z.object({ items: z.array(VisaProductSummarySchema) });

export const VisaProductDetailSchema = VisaProductSummarySchema.extend({
  requirements: z.array(z.string()),
  notes: nullableText(),
});

export const VisaProductInputSchema = z.object({
  country: Text(2, 80),
  countryBn: OptionalText(80),
  visaType: Text(2, 80),
  summary: Text(10, 300),
  processingTime: Text(2, 80),
  validity: OptionalText(80),
  fee: MoneySchema,
  requirements: z.array(Text(1, 300)).min(1).max(30),
  notes: OptionalText(5000),
  status: z.enum(["DRAFT", "PUBLISHED", "SUSPENDED"]),
  sortOrder: z.number().int().min(0).max(10000).default(0),
  heroMedia: MediaKeySchema.nullable().optional(),
});
export const CreateVisaProductSchema = VisaProductInputSchema.extend({ slug: SlugSchema });

export const AdminVisaProductSchema = z
  .object({
    id: PublicIdSchema,
    slug: SlugSchema,
    country: z.string(),
    countryBn: nullableText(80),
    visaType: z.string(),
    summary: z.string(),
    processingTime: z.string(),
    validity: nullableText(80),
    fee: MoneySchema,
    requirements: z.array(z.string()),
    notes: nullableText(),
    status: z.enum(["DRAFT", "PUBLISHED", "SUSPENDED"]),
    sortOrder: z.number().int(),
    hero: HeroRefSchema.nullable(),
    openRequests: z.number().int(),
  })
  .meta({ id: "AdminVisaProduct" });
export const AdminVisaProductListSchema = z.object({ items: z.array(AdminVisaProductSchema) });

// ─── Requests ───────────────────────────────────────────────────────────────

export const VisaDetailsSchema = z.object({
  travelDate: CalendarDateSchema,
  purpose: z.enum(["TOURISM", "BUSINESS", "FAMILY", "STUDY", "MEDICAL", "OTHER"]),
  /** ISO 3166-1 alpha-2 of the passports (most customers: BD). */
  nationality: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/)
    .default("BD"),
});
export type VisaDetails = z.infer<typeof VisaDetailsSchema>;

export const FlightDetailsSchema = z
  .object({
    tripType: z.enum(["ONE_WAY", "ROUND_TRIP"]),
    from: Text(2, 80),
    to: Text(2, 80),
    departDate: CalendarDateSchema,
    returnDate: CalendarDateSchema.nullable(),
    adults: z.number().int().min(1).max(9),
    children: z.number().int().min(0).max(9),
    infants: z.number().int().min(0).max(9),
    cabin: z.enum(["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"]),
    preferredAirline: OptionalText(80),
  })
  .refine(
    (d) => d.tripType === "ONE_WAY" || (d.returnDate !== null && d.returnDate >= d.departDate),
    {
      message: "Choose a return date on or after the departure",
      path: ["returnDate"],
    },
  )
  .refine((d) => d.infants <= d.adults, {
    message: "Each infant travels with an adult",
    path: ["infants"],
  });
export type FlightDetails = z.infer<typeof FlightDetailsSchema>;

export const CreateVisaRequestSchema = z.object({
  visaProductSlug: SlugSchema,
  travellers: z.number().int().min(1).max(50),
  details: VisaDetailsSchema,
  contact: BookingContactSchema,
  note: OptionalText(1000),
});
export type CreateVisaRequest = z.infer<typeof CreateVisaRequestSchema>;

export const CreateFlightRequestSchema = z.object({
  details: FlightDetailsSchema,
  contact: BookingContactSchema,
  note: OptionalText(1000),
});
export type CreateFlightRequest = z.infer<typeof CreateFlightRequestSchema>;

export const ServiceDocumentSchema = z
  .object({
    id: PublicIdSchema,
    label: z.string(),
    fileName: z.string(),
    mime: z.string(),
    byteSize: z.number().int(),
    uploadedByStaff: z.boolean(),
    createdAt: InstantSchema,
  })
  .meta({ id: "ServiceDocument" });

export const ServiceEventSchema = z
  .object({
    at: InstantSchema,
    actor: z.enum(["CUSTOMER", "STAFF", "SYSTEM"]),
    toStatus: ServiceStatusSchema.nullable(),
    message: nullableText(2000),
  })
  .meta({ id: "ServiceEvent" });

export const ServiceRequestSummarySchema = z
  .object({
    id: PublicIdSchema,
    reference: z.string(),
    kind: ServiceKindSchema,
    status: ServiceStatusSchema,
    /** e.g. "Thailand · Tourist e-visa" or "Dhaka → Bangkok · Round trip". */
    title: z.string(),
    travellers: z.number().int(),
    quote: MoneySchema.nullable(),
    createdAt: InstantSchema,
    updatedAt: InstantSchema,
  })
  .meta({ id: "ServiceRequestSummary" });

export const ServiceRequestListSchema = z.object({
  items: z.array(ServiceRequestSummarySchema),
  nextCursor: nullableText(200),
});

export const ServiceRequestDetailSchema = ServiceRequestSummarySchema.extend({
  visa: VisaDetailsSchema.nullable(),
  flight: z
    .object({
      tripType: z.enum(["ONE_WAY", "ROUND_TRIP"]),
      from: z.string(),
      to: z.string(),
      departDate: CalendarDateSchema,
      returnDate: CalendarDateSchema.nullable(),
      adults: z.number().int(),
      children: z.number().int(),
      infants: z.number().int(),
      cabin: z.enum(["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"]),
      preferredAirline: nullableText(80),
    })
    .nullable(),
  visaProduct: z
    .object({
      slug: SlugSchema,
      country: z.string(),
      visaType: z.string(),
      requirements: z.array(z.string()),
    })
    .nullable(),
  contactName: z.string(),
  contactEmail: z.string(),
  contactPhone: z.string(),
  note: nullableText(1000),
  quoteNote: nullableText(1000),
  quotedAt: InstantSchema.nullable(),
  paidAt: InstantSchema.nullable(),
  events: z.array(ServiceEventSchema),
  documents: z.array(ServiceDocumentSchema),
  documentsPurged: z.boolean(),
  /** Uploads need DOCUMENT_ENCRYPTION_KEY on the server. */
  uploadsEnabled: z.boolean(),
  canCancel: z.boolean(),
  canReply: z.boolean(),
  canUpload: z.boolean(),
});
export type ServiceRequestDetail = z.infer<typeof ServiceRequestDetailSchema>;

export const ServiceReplySchema = z.object({ message: Text(2, 2000) });
export const ServiceCancelSchema = z.object({ reason: OptionalText(500) });
export const DocumentUploadQuerySchema = z.object({
  label: Text(2, 80),
  name: Text(1, 160),
});

// ─── Console ────────────────────────────────────────────────────────────────

export const AdminServiceListQuerySchema = z.object({
  kind: ServiceKindSchema.optional(),
  status: ServiceStatusSchema.optional(),
  q: z.string().trim().max(80).optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const AdminServiceRequestSchema = ServiceRequestDetailSchema.extend({
  customer: z.object({ id: PublicIdSchema, name: z.string(), email: z.string() }),
  paidOffline: nullableText(200),
  staffEvents: z.array(
    ServiceEventSchema.extend({
      actorName: nullableText(120),
      internal: z.boolean(),
      fromStatus: ServiceStatusSchema.nullable(),
    }),
  ),
});

export const AdminServiceListSchema = z.object({
  items: z.array(
    ServiceRequestSummarySchema.extend({
      customerName: z.string(),
      contactPhone: z.string(),
    }),
  ),
  nextCursor: nullableText(200),
});

/** One staff action; `expectedStatus` guards against two people acting at once. */
export const ServiceActionSchema = z
  .object({
    action: z.enum([
      "NEEDS_INFO",
      "QUOTE",
      "MARK_PAID",
      "START",
      "COMPLETE",
      "REJECT",
      "CANCEL",
      "NOTE",
    ]),
    expectedStatus: ServiceStatusSchema,
    message: OptionalText(2000),
    /** QUOTE: the total price for the whole request. */
    amount: MoneySchema.optional(),
    /** MARK_PAID: receipt, bKash or bank reference. */
    paymentReference: OptionalText(200),
    /** NOTE: staff-only when true. */
    internal: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    const need = (ok: boolean, path: string, message: string) => {
      if (!ok) ctx.addIssue({ code: "custom", path: [path], message });
    };
    if (["NEEDS_INFO", "COMPLETE", "REJECT", "CANCEL", "NOTE"].includes(v.action)) {
      need(!!v.message && v.message.length >= 2, "message", "Write a short message");
    }
    if (v.action === "QUOTE")
      need(!!v.amount && v.amount.amountMinor > 0, "amount", "Enter the price");
    if (v.action === "MARK_PAID") {
      need(
        !!v.paymentReference && v.paymentReference.length >= 3,
        "paymentReference",
        "Enter the payment reference",
      );
    }
  });
export type ServiceAction = z.infer<typeof ServiceActionSchema>;
