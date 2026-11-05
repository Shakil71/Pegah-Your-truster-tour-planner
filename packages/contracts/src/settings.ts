import { z } from "zod";
import { nullableText } from "./common";

/**
 * Site settings edited in the console (ADR-0029). Non-secret values are
 * returned as stored; secrets are write-only and only reported as "set".
 */

const Text = (max: number) => z.string().trim().max(max);

export const GeneralSettingsSchema = z.object({
  supportPhone: Text(20),
  supportEmail: z.union([z.email(), z.literal("")]),
  whatsapp: Text(20),
  officeAddress: Text(300),
  /** Where staff alerts go (new offer and gift card purchases). Empty = support email. */
  notificationEmail: z.union([z.email(), z.literal("")]).optional(),
});
export type GeneralSettings = z.infer<typeof GeneralSettingsSchema>;

export const AnnouncementSchema = z
  .object({
    enabled: z.boolean(),
    tone: z.enum(["info", "warning"]),
    textEn: Text(240),
    textBn: Text(240),
    /** Optional link, a site path ("/pages/…") or https URL. */
    linkHref: z.union([z.string().regex(/^(\/[\w\-./?=&#%]*|https:\/\/\S+)$/), z.literal("")]),
  })
  .refine((a) => !a.enabled || (a.textEn.length > 0 && a.textBn.length > 0), {
    message: "Write the announcement in English and Bangla before turning it on",
    path: ["textEn"],
  });
export type Announcement = z.infer<typeof AnnouncementSchema>;

export const BookingSettingsSchema = z.object({
  /** How long a hold keeps rooms or seats before payment. */
  holdMinutes: z.number().int().min(5).max(60),
  /** Extra time granted once when the customer opens the payment page. */
  paymentExtensionMinutes: z.number().int().min(0).max(60),
});
export type BookingSettings = z.infer<typeof BookingSettingsSchema>;

/** Payment provider, chosen in the console. The simulator is never selectable here. */
export const PaymentSettingsInputSchema = z
  .object({
    provider: z.enum(["none", "sslcommerz"]),
    mode: z.enum(["sandbox", "live"]),
    /** Owner confirms the sandbox checklist passed and live payments may start. */
    liveApproved: z.boolean(),
    storeId: Text(64),
    /** Write-only. Omit to keep the stored password. */
    storePassword: z.string().min(1).max(128).optional(),
  })
  .refine((p) => p.mode === "sandbox" || p.liveApproved, {
    message: "Live mode needs the owner's live approval",
    path: ["liveApproved"],
  });
export type PaymentSettingsInput = z.infer<typeof PaymentSettingsInputSchema>;

export const EmailSettingsInputSchema = z.object({
  transport: z.enum(["none", "smtp"]),
  from: Text(200).min(3),
  smtpHost: Text(200),
  smtpPort: z.number().int().min(1).max(65535),
  /** true = implicit TLS (465); false = STARTTLS (587). Plain SMTP is never used. */
  smtpSecure: z.boolean(),
  smtpUser: Text(200),
  /** Write-only. Omit to keep the stored password. */
  smtpPassword: z.string().min(1).max(200).optional(),
});
export type EmailSettingsInput = z.infer<typeof EmailSettingsInputSchema>;

export const SiteSettingsViewSchema = z.object({
  general: GeneralSettingsSchema,
  announcement: AnnouncementSchema,
  booking: BookingSettingsSchema,
  payments: z.object({
    provider: z.enum(["none", "sslcommerz", "simulator"]),
    mode: z.enum(["sandbox", "live"]),
    liveApproved: z.boolean(),
    storeId: z.string(),
    storePasswordSet: z.boolean(),
    /** "console" when saved in the console, "server" when it still comes from api.env. */
    source: z.enum(["console", "server"]),
  }),
  email: z.object({
    transport: z.enum(["none", "log", "smtp"]),
    from: z.string(),
    smtpHost: z.string(),
    smtpPort: z.number().int(),
    smtpSecure: z.boolean(),
    smtpUser: z.string(),
    smtpPasswordSet: z.boolean(),
    source: z.enum(["console", "server"]),
  }),
  /** False when SETTINGS_ENCRYPTION_KEY is missing on the server: secrets cannot be saved. */
  encryptionReady: z.boolean(),
  /** Public base URL for payment returns (server configuration). */
  publicBaseUrl: nullableText(255),
});
export type SiteSettingsView = z.infer<typeof SiteSettingsViewSchema>;

export const EmailTestResultSchema = z.object({
  status: z.enum(["SENT", "SKIPPED", "FAILED"]),
  to: z.string(),
});

/** What the public website needs: contact details and the announcement. */
export const PublicSiteSchema = z.object({
  general: GeneralSettingsSchema,
  announcement: AnnouncementSchema.nullable(),
});
export type PublicSite = z.infer<typeof PublicSiteSchema>;
