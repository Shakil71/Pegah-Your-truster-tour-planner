import { z } from "zod";
import { EmailSchema, PasswordSchema, BdPhoneSchema } from "./auth";
import { BookingStatusSchema, BookingSummarySchema } from "./booking";
import {
  CalendarDateSchema,
  InstantSchema,
  MoneySchema,
  PublicIdSchema,
  nullableText,
} from "./common";
import { PermissionSchema, StaffRoleSchema } from "./permissions";

// ─── Dashboard ──────────────────────────────────────────────────────────────

export const DashboardSummarySchema = z.object({
  generatedAt: InstantSchema,
  /** Today's date in Asia/Dhaka; day series end here. */
  today: CalendarDateSchema,
  kpis: z.object({
    /** Sum of CONFIRMED + COMPLETED bookings created in the last 30 days. */
    confirmedValue30d: MoneySchema,
    confirmedValuePrev30d: MoneySchema,
    bookings30d: z.number().int(),
    bookingsPrev30d: z.number().int(),
    /** Rooms held or sold ÷ rooms available across all hotels, next 14 nights. */
    occupancyNext14d: z.number().int().min(0).max(100),
    pendingPayment: z.number().int(),
    needsAction: z.number().int(),
  }),
  statusCounts: z.array(z.object({ status: BookingStatusSchema, count: z.number().int() })),
  /**
   * Value of bookings created per day (last 30 days, oldest first), split
   * into confirmed revenue and value that is still held/awaiting payment.
   */
  daily: z.array(
    z.object({
      date: CalendarDateSchema,
      bookings: z.number().int(),
      confirmed: MoneySchema,
      pending: MoneySchema,
    }),
  ),
  occupancy: z.object({
    days: z.array(CalendarDateSchema),
    hotels: z.array(
      z.object({
        name: z.string(),
        slug: z.string(),
        /** Percent per day; null when the hotel has no inventory that night. */
        values: z.array(z.number().int().min(0).max(100).nullable()),
      }),
    ),
  }),
  departures: z.array(
    z.object({
      id: PublicIdSchema,
      tourTitle: z.string(),
      tourSlug: z.string(),
      departsAt: InstantSchema,
      capacity: z.number().int(),
      held: z.number().int(),
      sold: z.number().int(),
    }),
  ),
  recentBookings: z.array(BookingSummarySchema),
  recentActivity: z.array(
    z.object({
      action: z.string(),
      actorType: z.enum(["CUSTOMER", "STAFF", "SYSTEM", "PAYMENT_PROVIDER"]),
      actorName: nullableText(),
      targetType: nullableText(),
      targetId: nullableText(),
      at: InstantSchema,
    }),
  ),
});
export type DashboardSummary = z.infer<typeof DashboardSummarySchema>;

// ─── Staff and roles ────────────────────────────────────────────────────────

export const StaffMemberSchema = z.object({
  id: PublicIdSchema,
  email: z.string(),
  fullName: z.string(),
  phone: nullableText(),
  status: z.enum(["ACTIVE", "DISABLED"]),
  roles: z.array(z.string()),
  lastLoginAt: InstantSchema.nullable(),
  createdAt: InstantSchema,
});
export type StaffMember = z.infer<typeof StaffMemberSchema>;

export const RoleViewSchema = z
  .object({
    key: z.string(),
    name: z.string(),
    description: z.string(),
    permissions: z.array(PermissionSchema),
    memberCount: z.number().int(),
  })
  .meta({ id: "Role" });

export const StaffListResponseSchema = z.object({
  items: z.array(StaffMemberSchema),
  roles: z.array(RoleViewSchema),
});
export type StaffListResponse = z.infer<typeof StaffListResponseSchema>;

export const CreateStaffRequestSchema = z.object({
  email: EmailSchema,
  fullName: z.string().trim().min(2).max(120),
  phone: BdPhoneSchema.optional(),
  /** Initial password, shared with the person out of band; they should change it. */
  password: PasswordSchema,
  roles: z.array(StaffRoleSchema).min(1).max(6),
});
export type CreateStaffRequest = z.infer<typeof CreateStaffRequestSchema>;

export const UpdateStaffRequestSchema = z
  .object({
    roles: z.array(StaffRoleSchema).min(1).max(6).optional(),
    status: z.enum(["ACTIVE", "DISABLED"]).optional(),
  })
  .refine((v) => v.roles !== undefined || v.status !== undefined, {
    message: "Change roles, status, or both",
  });
export type UpdateStaffRequest = z.infer<typeof UpdateStaffRequestSchema>;

// ─── Audit log ──────────────────────────────────────────────────────────────

export const AuditEventViewSchema = z
  .object({
    id: z.string(),
    action: z.string(),
    actorType: z.enum(["CUSTOMER", "STAFF", "SYSTEM", "PAYMENT_PROVIDER"]),
    actorName: nullableText(),
    actorEmail: nullableText(),
    targetType: nullableText(),
    targetId: nullableText(),
    ipAddress: nullableText(),
    metadata: z.unknown().nullable(),
    at: InstantSchema,
  })
  .meta({ id: "AuditEvent" });
export type AuditEventView = z.infer<typeof AuditEventViewSchema>;

export const AuditListQuerySchema = z.object({
  action: z
    .string()
    .trim()
    .regex(/^[a-z_.]{1,80}$/)
    .optional(),
  targetId: z.string().trim().max(40).optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type AuditListQuery = z.infer<typeof AuditListQuerySchema>;

export const AuditListResponseSchema = z.object({
  items: z.array(AuditEventViewSchema),
  nextCursor: nullableText(),
});
export type AuditListResponse = z.infer<typeof AuditListResponseSchema>;
