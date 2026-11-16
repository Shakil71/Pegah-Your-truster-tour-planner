import { z } from "zod";
import { EmailSchema } from "./auth";
import { CalendarDateSchema, InstantSchema, PublicIdSchema, nullableText } from "./common";

/**
 * Contact form (ADR-0041): anyone can ask about a booking, a reservation, a
 * package or anything else. Sending a message never holds or confirms
 * anything; staff answer by phone or email and track the status.
 */

export const CONTACT_TOPICS = ["BOOKING", "RESERVATION", "PACKAGE", "OTHER"] as const;
export const ContactTopicSchema = z.enum(CONTACT_TOPICS);
export type ContactTopic = z.infer<typeof ContactTopicSchema>;

export const CONTACT_STATUSES = ["NEW", "IN_PROGRESS", "CLOSED"] as const;
export const ContactStatusSchema = z.enum(CONTACT_STATUSES);
export type ContactStatus = z.infer<typeof ContactStatusSchema>;

/** Any phone number: Bangladeshi or international, spaces and dashes allowed. */
export const ContactPhoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[\d\s-]{7,20}$/, "Enter a phone number")
  .transform((v) => v.replace(/[\s-]/g, ""))
  .pipe(z.string().min(7).max(20));

export const ContactMessageCreateSchema = z.object({
  topic: ContactTopicSchema,
  name: z.string().trim().min(2).max(120),
  email: EmailSchema,
  phone: ContactPhoneSchema,
  travelDate: CalendarDateSchema.optional(),
  guests: z.number().int().min(1).max(500).optional(),
  message: z.string().trim().min(10).max(3000),
  /** Language for the acknowledgement email. */
  locale: z.enum(["en", "bn"]).optional(),
  /** Honeypot: people never see it; bots fill it in. Must stay empty. */
  website: z.string().max(0).optional(),
});
export type ContactMessageCreate = z.infer<typeof ContactMessageCreateSchema>;

export const ContactMessageReceiptSchema = z.object({ reference: z.string() });

export const AdminContactMessageSchema = z.object({
  id: PublicIdSchema,
  reference: z.string(),
  topic: ContactTopicSchema,
  status: ContactStatusSchema,
  name: z.string(),
  email: z.string(),
  phone: z.string(),
  travelDate: CalendarDateSchema.nullable(),
  guests: z.number().int().nullable(),
  message: z.string(),
  /** True when sent while signed in as a customer. */
  signedIn: z.boolean(),
  staffNote: nullableText(1000),
  handledBy: nullableText(120),
  handledAt: InstantSchema.nullable(),
  createdAt: InstantSchema,
});
export type AdminContactMessage = z.infer<typeof AdminContactMessageSchema>;

export const AdminContactListQuerySchema = z.object({
  status: ContactStatusSchema.optional(),
  q: z.string().trim().max(80).optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const AdminContactListSchema = z.object({
  items: z.array(AdminContactMessageSchema),
  counts: z.object({
    NEW: z.number().int(),
    IN_PROGRESS: z.number().int(),
    CLOSED: z.number().int(),
  }),
  nextCursor: nullableText(200),
});

export const AdminContactUpdateSchema = z.object({
  status: ContactStatusSchema,
  staffNote: z.string().trim().max(1000).optional(),
});
