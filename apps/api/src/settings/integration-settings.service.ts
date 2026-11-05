import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import {
  AnnouncementSchema,
  BookingSettingsSchema,
  GeneralSettingsSchema,
  type Announcement,
  type BookingSettings,
  type EmailSettingsInput,
  type GeneralSettings,
  type PaymentSettingsInput,
  type PublicSite,
  type SiteSettingsView,
} from "@pegah/contracts";
import type { Prisma } from "@pegah/db";
import { createTransport, type Transporter } from "nodemailer";
import { z } from "zod";
import { AuditService } from "../audit/audit.service";
import type { AuthContext } from "../auth/auth.types";
import { ProblemException } from "../common/problem";
import { APP_CONFIG, type AppConfig } from "../config/config";
import type { PaymentProvider } from "../payments/provider";
import { SimulatorProvider } from "../payments/simulator.provider";
import { SslcommerzProvider } from "../payments/sslcommerz.provider";
import { PRISMA, type Db } from "../prisma/prisma.service";
import { SecretBox } from "./secret-box";

const REFRESH_MS = 30_000;
const SECRET = { storePassword: "sslcommerz.storePassword", smtpPassword: "smtp.password" };

const StoredPayments = z.object({
  provider: z.enum(["none", "sslcommerz"]),
  mode: z.enum(["sandbox", "live"]),
  liveApproved: z.boolean(),
  storeId: z.string(),
});
const StoredEmail = z.object({
  transport: z.enum(["none", "smtp"]),
  from: z.string(),
  smtpHost: z.string(),
  smtpPort: z.number().int(),
  smtpSecure: z.boolean(),
  smtpUser: z.string(),
});

interface EffectivePayments {
  provider: "none" | "sslcommerz" | "simulator";
  mode: "sandbox" | "live";
  liveApproved: boolean;
  storeId: string;
  storePassword: string | null;
  source: "console" | "server";
}
interface EffectiveEmail {
  transport: "none" | "log" | "smtp";
  from: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword: string | null;
  source: "console" | "server";
}
export interface EmailChannel {
  transport: "none" | "log" | "smtp";
  from: string;
  transporter: Transporter | null;
}

/** Pegah published company details; the owner can change them in Settings. */
const DEFAULT_GENERAL: GeneralSettings = {
  supportPhone: "+8801784782962",
  supportEmail: "pegah.com.bd@gmail.com",
  whatsapp: "+8801784782962",
  officeAddress: "153/1, Shahalibag, Mirpur-1, Dhaka-1216",
  notificationEmail: "pegah.com.bd@gmail.com",
};
const DEFAULT_ANNOUNCEMENT: Announcement = {
  enabled: false,
  tone: "info",
  textEn: "",
  textBn: "",
  linkHref: "",
};

/**
 * Settings the owner controls from the console (ADR-0029), merged over the
 * server environment: a section saved in the console wins; otherwise api.env
 * applies, so existing servers keep working unchanged. Payment and email
 * adapters are rebuilt when their settings change, without a restart. Every
 * process re-reads the settings every 30 s, so the worker follows too.
 * Secrets are sealed with SETTINGS_ENCRYPTION_KEY and never returned.
 */
@Injectable()
export class IntegrationSettings implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger("Settings");
  private readonly box: SecretBox | null;
  private timer: NodeJS.Timeout | undefined;

  private general = DEFAULT_GENERAL;
  private announcement = DEFAULT_ANNOUNCEMENT;
  private booking: BookingSettings;
  private payments: EffectivePayments;
  private email: EffectiveEmail;

  private provider: PaymentProvider | null = null;
  private providerKey = "";
  private transporter: Transporter | null = null;
  private transporterKey = "";

  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {
    this.box = config.SETTINGS_ENCRYPTION_KEY
      ? new SecretBox(config.SETTINGS_ENCRYPTION_KEY)
      : null;
    this.booking = {
      holdMinutes: config.BOOKING_HOLD_MINUTES,
      paymentExtensionMinutes: config.PAYMENT_HOLD_EXTENSION_MINUTES,
    };
    this.payments = this.envPayments();
    this.email = this.envEmail();
    this.rebuild();
  }

  async onModuleInit(): Promise<void> {
    await this.reload();
    this.timer = setInterval(() => void this.reload(), REFRESH_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  // ── What the rest of the API uses ─────────────────────────────────────────
  paymentProvider(): PaymentProvider | null {
    return this.provider;
  }
  emailChannel(): EmailChannel {
    return {
      transport: this.email.transport,
      from: this.email.from,
      transporter: this.transporter,
    };
  }
  holdMinutes(): number {
    return this.booking.holdMinutes;
  }
  paymentExtensionMinutes(): number {
    return this.booking.paymentExtensionMinutes;
  }
  /** Address for staff alerts about purchases. */
  notificationEmail(): string {
    return this.general.notificationEmail || this.general.supportEmail || "pegah.com.bd@gmail.com";
  }

  publicSite(): PublicSite {
    return {
      general: this.general,
      announcement: this.announcement.enabled ? this.announcement : null,
    };
  }

  view(): SiteSettingsView {
    const p = this.payments;
    const e = this.email;
    return {
      general: this.general,
      announcement: this.announcement,
      booking: this.booking,
      payments: {
        provider: p.provider,
        mode: p.mode,
        liveApproved: p.liveApproved,
        storeId: p.storeId,
        storePasswordSet: Boolean(p.storePassword),
        source: p.source,
      },
      email: {
        transport: e.transport,
        from: e.from,
        smtpHost: e.smtpHost,
        smtpPort: e.smtpPort,
        smtpSecure: e.smtpSecure,
        smtpUser: e.smtpUser,
        smtpPasswordSet: Boolean(e.smtpPassword),
        source: e.source,
      },
      encryptionReady: this.box !== null,
      publicBaseUrl: this.config.PUBLIC_BASE_URL ?? null,
    };
  }

  // ── Saving (each section is audited; secrets are never logged) ────────────
  async saveGeneral(input: GeneralSettings, actor: AuthContext, ip: string | null) {
    await this.saveSection("general", input, actor, ip, input);
    return this.view();
  }
  async saveAnnouncement(input: Announcement, actor: AuthContext, ip: string | null) {
    await this.saveSection("announcement", input, actor, ip, {
      enabled: input.enabled,
      tone: input.tone,
    });
    return this.view();
  }
  async saveBooking(input: BookingSettings, actor: AuthContext, ip: string | null) {
    await this.saveSection("booking", input, actor, ip, input);
    return this.view();
  }

  async savePayments(input: PaymentSettingsInput, actor: AuthContext, ip: string | null) {
    if (input.provider === "sslcommerz") {
      if (!this.config.PUBLIC_BASE_URL) {
        throw new ProblemException(
          422,
          "public-url-missing",
          "PUBLIC_BASE_URL is not set on the server",
        );
      }
      if (
        this.config.NODE_ENV === "production" &&
        !this.config.PUBLIC_BASE_URL.startsWith("https://")
      ) {
        throw new ProblemException(422, "https-required", "Payments need an https:// site address");
      }
      if (!input.storeId) {
        throw new ProblemException(422, "store-id-required", "Enter the SSLCOMMERZ store ID");
      }
      const hasPassword =
        input.storePassword !== undefined || (await this.hasSecret(SECRET.storePassword));
      if (!hasPassword) {
        throw new ProblemException(
          422,
          "store-password-required",
          "Enter the SSLCOMMERZ store password",
        );
      }
    }
    const { storePassword, ...stored } = input;
    await this.saveSection("payments", stored, actor, ip, stored, async (tx) => {
      if (storePassword !== undefined)
        await this.putSecret(tx, SECRET.storePassword, storePassword, actor);
    });
    return this.view();
  }

  async saveEmail(input: EmailSettingsInput, actor: AuthContext, ip: string | null) {
    if (input.transport === "smtp") {
      if (!input.smtpHost || !input.smtpUser) {
        throw new ProblemException(422, "smtp-incomplete", "Enter the SMTP server and user name");
      }
      const hasPassword =
        input.smtpPassword !== undefined || (await this.hasSecret(SECRET.smtpPassword));
      if (!hasPassword) {
        throw new ProblemException(422, "smtp-password-required", "Enter the SMTP password");
      }
    }
    const { smtpPassword, ...stored } = input;
    await this.saveSection("email", stored, actor, ip, stored, async (tx) => {
      if (smtpPassword !== undefined)
        await this.putSecret(tx, SECRET.smtpPassword, smtpPassword, actor);
    });
    return this.view();
  }

  // ── Internals ──────────────────────────────────────────────────────────────
  private async saveSection(
    key: string,
    value: object,
    actor: AuthContext,
    ip: string | null,
    auditMeta: object,
    extra?: (tx: Parameters<Parameters<Db["$transaction"]>[0]>[0]) => Promise<void>,
  ): Promise<void> {
    await this.db.$transaction(async (tx) => {
      await tx.siteSetting.upsert({
        where: { key },
        create: { key, value, updatedBy: actor.user.id },
        update: { value, updatedBy: actor.user.id },
      });
      if (extra) await extra(tx);
      await this.audit.record(
        {
          actorType: "STAFF",
          actorUserId: actor.user.id,
          action: `settings.${key}_updated`,
          targetType: "settings",
          targetId: key,
          ipAddress: ip,
          metadata: auditMeta as Prisma.InputJsonValue,
        },
        tx,
      );
    });
    await this.reload();
  }

  private async putSecret(
    tx: Parameters<Parameters<Db["$transaction"]>[0]>[0],
    key: string,
    value: string,
    actor: AuthContext,
  ): Promise<void> {
    if (!this.box) {
      throw new ProblemException(
        422,
        "encryption-key-missing",
        "SETTINGS_ENCRYPTION_KEY is not set on the server, so passwords cannot be saved",
      );
    }
    const ciphertext = this.box.seal(value, key);
    await tx.secretSetting.upsert({
      where: { key },
      create: { key, ciphertext, keyId: this.box.keyId, updatedBy: actor.user.id },
      update: { ciphertext, keyId: this.box.keyId, updatedBy: actor.user.id },
    });
  }

  private async hasSecret(key: string): Promise<boolean> {
    const row = await this.db.secretSetting.findUnique({ where: { key } });
    return Boolean(row && this.box && row.keyId === this.box.keyId);
  }

  /** Reads the console settings; on any database error keeps the last good values. */
  async reload(): Promise<void> {
    try {
      const [rows, secrets] = await Promise.all([
        this.db.siteSetting.findMany(),
        this.db.secretSetting.findMany(),
      ]);
      const value = (key: string) => rows.find((r) => r.key === key)?.value;
      const secret = (key: string): string | null => {
        const row = secrets.find((s) => s.key === key);
        if (!row) return null;
        if (!this.box || row.keyId !== this.box.keyId) {
          this.logger.warn({ key }, "Stored secret sealed with another key; ignored");
          return null;
        }
        return this.box.open(row.ciphertext, key);
      };

      this.general = GeneralSettingsSchema.safeParse(value("general")).data ?? DEFAULT_GENERAL;
      this.announcement =
        AnnouncementSchema.safeParse(value("announcement")).data ?? DEFAULT_ANNOUNCEMENT;
      this.booking = BookingSettingsSchema.safeParse(value("booking")).data ?? {
        holdMinutes: this.config.BOOKING_HOLD_MINUTES,
        paymentExtensionMinutes: this.config.PAYMENT_HOLD_EXTENSION_MINUTES,
      };

      const pay = StoredPayments.safeParse(value("payments"));
      this.payments = pay.success
        ? { ...pay.data, storePassword: secret(SECRET.storePassword), source: "console" }
        : this.envPayments();
      const mail = StoredEmail.safeParse(value("email"));
      this.email = mail.success
        ? { ...mail.data, smtpPassword: secret(SECRET.smtpPassword), source: "console" }
        : this.envEmail();
      this.rebuild();
    } catch (error) {
      this.logger.warn(
        { err: error instanceof Error ? error.message : error },
        "Settings reload failed",
      );
    }
  }

  private envPayments(): EffectivePayments {
    const c = this.config;
    return {
      provider: c.PAYMENT_PROVIDER,
      mode: c.SSLCOMMERZ_MODE,
      liveApproved: c.SSLCOMMERZ_LIVE_APPROVED,
      storeId: c.SSLCOMMERZ_STORE_ID ?? "",
      storePassword: c.SSLCOMMERZ_STORE_PASSWORD ?? null,
      source: "server",
    };
  }

  private envEmail(): EffectiveEmail {
    const c = this.config;
    return {
      transport: c.EMAIL_TRANSPORT,
      from: c.EMAIL_FROM,
      smtpHost: c.SMTP_HOST ?? "",
      smtpPort: c.SMTP_PORT,
      smtpSecure: c.SMTP_SECURE,
      smtpUser: c.SMTP_USER ?? "",
      smtpPassword: c.SMTP_PASSWORD ?? null,
      source: "server",
    };
  }

  /** Builds the payment and email adapters again only when their settings changed. */
  private rebuild(): void {
    const p = this.payments;
    const pKey = JSON.stringify(p);
    if (pKey !== this.providerKey) {
      this.providerKey = pKey;
      this.provider = this.buildProvider(p);
    }
    const e = this.email;
    const eKey = JSON.stringify(e);
    if (eKey !== this.transporterKey) {
      this.transporterKey = eKey;
      this.transporter?.close();
      this.transporter =
        e.transport === "smtp" && e.smtpHost && e.smtpPassword
          ? createTransport({
              host: e.smtpHost,
              port: e.smtpPort,
              secure: e.smtpSecure,
              requireTLS: !e.smtpSecure,
              auth: { user: e.smtpUser, pass: e.smtpPassword },
              connectionTimeout: 10_000,
              greetingTimeout: 10_000,
              socketTimeout: 20_000,
            })
          : null;
    }
  }

  private buildProvider(p: EffectivePayments): PaymentProvider | null {
    const base = this.config.PUBLIC_BASE_URL?.replace(/\/$/, "");
    if (p.provider === "simulator") {
      // Only ever from api.env; loadConfig refuses it in production.
      if (!base) return null;
      this.logger.warn("Payment SIMULATOR enabled — development/testing only");
      return new SimulatorProvider(base);
    }
    if (p.provider !== "sslcommerz") return null;
    if (!base || !p.storeId || !p.storePassword) {
      this.logger.warn(
        "SSLCOMMERZ selected but incomplete (address, store ID or password); payments off",
      );
      return null;
    }
    if (p.mode === "live" && !p.liveApproved) {
      this.logger.warn("SSLCOMMERZ live mode without live approval; payments off");
      return null;
    }
    this.logger.log(`SSLCOMMERZ enabled (${p.mode})`);
    return new SslcommerzProvider({
      storeId: p.storeId,
      storePassword: p.storePassword,
      mode: p.mode,
      productProfile: this.config.SSLCOMMERZ_PRODUCT_PROFILE,
    });
  }
}
