import { z } from "zod";
import { EmailSchema, PasswordSchema, BdPhoneSchema } from "./auth";
import { AdminDepartureSchema } from "./admin-catalog";
import { BookingSummarySchema } from "./booking";
import { InstantSchema, MoneySchema, PublicIdSchema, SlugSchema, nullableText } from "./common";

/** Partner companies and the partner portal (Phase 7, ADR-0026). */

export const PartnerKindSchema = z.enum(["SUPPLIER", "AGENT"]);
export type PartnerKind = z.infer<typeof PartnerKindSchema>;

export const PartnerViewSchema = z
  .object({
    id: PublicIdSchema,
    kind: PartnerKindSchema,
    name: z.string(),
    email: z.string(),
    phone: nullableText(20),
    commissionBps: z.number().int(),
    status: z.enum(["ACTIVE", "SUSPENDED"]),
    members: z.array(
      z.object({
        id: PublicIdSchema,
        fullName: z.string(),
        email: z.string(),
        status: z.enum(["ACTIVE", "DISABLED"]),
      }),
    ),
    hotels: z.array(z.object({ slug: SlugSchema, name: z.string() })),
    tours: z.array(z.object({ slug: SlugSchema, title: z.string() })),
    createdAt: InstantSchema,
  })
  .meta({ id: "Partner" });
export type PartnerView = z.infer<typeof PartnerViewSchema>;

export const PartnerListSchema = z.object({ items: z.array(PartnerViewSchema) });

export const PartnerMemberInputSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: EmailSchema,
  /** Initial password, shared privately; the partner should change it. */
  password: PasswordSchema,
});
export type PartnerMemberInput = z.infer<typeof PartnerMemberInputSchema>;

const PartnerFields = {
  name: z.string().trim().min(2).max(160),
  email: EmailSchema,
  phone: BdPhoneSchema.nullable(),
  /** Agents: commission on the booking total in basis points (1000 = 10%), max 50%. */
  commissionBps: z.number().int().min(0).max(5000),
};

export const CreatePartnerSchema = z.object({
  kind: PartnerKindSchema,
  ...PartnerFields,
  member: PartnerMemberInputSchema,
});
export type CreatePartner = z.infer<typeof CreatePartnerSchema>;

export const UpdatePartnerSchema = z.object({
  ...PartnerFields,
  status: z.enum(["ACTIVE", "SUSPENDED"]),
});
export type UpdatePartner = z.infer<typeof UpdatePartnerSchema>;

/** Suppliers: which hotels and tours they manage (replaces the previous assignment). */
export const PartnerOwnershipSchema = z.object({
  hotelSlugs: z.array(SlugSchema).max(200),
  tourSlugs: z.array(SlugSchema).max(200),
});
export type PartnerOwnership = z.infer<typeof PartnerOwnershipSchema>;

// ─── Portal ─────────────────────────────────────────────────────────────────

export const PartnerOverviewSchema = z.object({
  partner: z.object({
    id: PublicIdSchema,
    kind: PartnerKindSchema,
    name: z.string(),
    commissionBps: z.number().int(),
  }),
  supplier: z
    .object({
      hotels: z.array(
        z.object({
          slug: SlugSchema,
          name: z.string(),
          status: z.enum(["DRAFT", "PUBLISHED", "SUSPENDED"]),
          rooms: z.array(z.object({ id: PublicIdSchema, name: z.string(), isActive: z.boolean() })),
        }),
      ),
      tours: z.array(
        z.object({
          slug: SlugSchema,
          title: z.string(),
          status: z.enum(["DRAFT", "PUBLISHED", "SUSPENDED"]),
          departures: z.array(AdminDepartureSchema),
        }),
      ),
      upcomingReservations: z.number().int(),
      confirmedValue30d: MoneySchema,
    })
    .nullable(),
  agent: z
    .object({
      bookings30d: z.number().int(),
      commissionEarned: MoneySchema,
      commissionPending: MoneySchema,
    })
    .nullable(),
});
export type PartnerOverview = z.infer<typeof PartnerOverviewSchema>;

export const PartnerBookingListSchema = z.object({
  items: z.array(
    BookingSummarySchema.extend({
      /** Agents: commission on this booking (earned once confirmed). */
      commission: MoneySchema,
    }),
  ),
  nextCursor: nullableText(200),
});
export type PartnerBookingList = z.infer<typeof PartnerBookingListSchema>;

export const StatementQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use YYYY-MM"),
});

export const AgentStatementSchema = z.object({
  month: z.string(),
  items: z.array(
    z.object({
      id: PublicIdSchema,
      reference: z.string(),
      productName: z.string(),
      status: z.string(),
      total: MoneySchema,
      commission: MoneySchema,
      createdAt: InstantSchema,
    }),
  ),
  totals: z.object({
    bookings: z.number().int(),
    confirmedValue: MoneySchema,
    commissionEarned: MoneySchema,
  }),
});
export type AgentStatement = z.infer<typeof AgentStatementSchema>;
