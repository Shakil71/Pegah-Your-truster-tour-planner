import { Body, Controller, Get, HttpCode, Inject, Post, Put, Req, Res } from "@nestjs/common";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import {
  AnnouncementSchema,
  BookingSettingsSchema,
  EmailSettingsInputSchema,
  EmailTestResultSchema,
  GeneralSettingsSchema,
  PaymentSettingsInputSchema,
  PublicSiteSchema,
  SiteSettingsViewSchema,
  SystemSettingsSchema,
  type SystemSettings,
} from "@pegah/contracts";
import type { FastifyReply, FastifyRequest } from "fastify";
import { createZodDto, ZodResponse } from "nestjs-zod";
import type { AuthContext } from "../auth/auth.types";
import { CurrentAuth, Public, RequirePermissions } from "../auth/decorators";
import { APP_CONFIG, type AppConfig } from "../config/config";
import { EmailService } from "../email/email.service";
import { BUILD, VERSION } from "../health/health.controller";
import { PRISMA, type Db } from "../prisma/prisma.service";
import { IntegrationSettings } from "../settings/integration-settings.service";

class AdminSystemSettingsDto extends createZodDto(SystemSettingsSchema) {}
class AdminSiteSettingsDto extends createZodDto(SiteSettingsViewSchema) {}
class AdminGeneralSettingsDto extends createZodDto(GeneralSettingsSchema) {}
class AdminAnnouncementDto extends createZodDto(AnnouncementSchema) {}
class AdminBookingSettingsDto extends createZodDto(BookingSettingsSchema) {}
class AdminPaymentSettingsDto extends createZodDto(PaymentSettingsInputSchema) {}
class AdminEmailSettingsDto extends createZodDto(EmailSettingsInputSchema) {}
class AdminEmailTestDto extends createZodDto(EmailTestResultSchema) {}
class PublicSiteDto extends createZodDto(PublicSiteSchema) {}

const noStore = (reply: FastifyReply) => void reply.header("cache-control", "no-store");
const ip = (r: FastifyRequest) => r.ip ?? null;

/**
 * Console settings (ADR-0027, ADR-0029). Status is read-only; contact details,
 * the announcement and booking times need settings:manage; payment and email
 * credentials need settings:secrets (owner). Secrets are never returned.
 */
@ApiTags("admin")
@ApiCookieAuth("staff")
@Controller("admin/settings")
export class AdminSettingsController {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(PRISMA) private readonly db: Db,
    @Inject(IntegrationSettings) private readonly settings: IntegrationSettings,
    @Inject(EmailService) private readonly email: EmailService,
  ) {}

  @RequirePermissions("settings:read")
  @Get()
  @ZodResponse({ status: 200, type: AdminSystemSettingsDto })
  async get(@Res({ passthrough: true }) reply: FastifyReply): Promise<SystemSettings> {
    noStore(reply);
    const c = this.config;
    const v = this.settings.view();
    let database: "up" | "down" = "up";
    let queued = 0;
    let failed = 0;
    try {
      [queued, failed] = await Promise.all([
        this.db.emailMessage.count({ where: { status: "QUEUED" } }),
        this.db.emailMessage.count({ where: { status: "FAILED" } }),
      ]);
    } catch {
      database = "down";
    }
    return {
      environment: c.NODE_ENV,
      version: VERSION,
      commit: BUILD.commit,
      builtAt: BUILD.builtAt,
      database,
      payments: {
        provider: this.settings.paymentProvider() ? v.payments.provider : "none",
        mode: v.payments.provider === "sslcommerz" ? v.payments.mode : null,
        liveApproved: v.payments.liveApproved,
        credentialsSet: Boolean(v.payments.storeId && v.payments.storePasswordSet),
        publicBaseUrl: c.PUBLIC_BASE_URL ?? null,
        holdExtensionMinutes: v.booking.paymentExtensionMinutes,
      },
      email: {
        transport: v.email.transport,
        from: v.email.from,
        smtpHost: v.email.transport === "smtp" ? v.email.smtpHost || null : null,
        queued,
        failed,
      },
      booking: { holdMinutes: v.booking.holdMinutes, holdSweepSeconds: c.HOLD_SWEEP_SECONDS },
      sessions: {
        customerTtlMinutes: c.CUSTOMER_SESSION_TTL_MIN,
        customerIdleMinutes: c.CUSTOMER_SESSION_IDLE_MIN,
        staffTtlMinutes: c.STAFF_SESSION_TTL_MIN,
        staffIdleMinutes: c.STAFF_SESSION_IDLE_MIN,
      },
    };
  }

  @RequirePermissions("settings:read")
  @Get("site")
  @ZodResponse({ status: 200, type: AdminSiteSettingsDto })
  site(@Res({ passthrough: true }) reply: FastifyReply) {
    noStore(reply);
    return this.settings.view();
  }

  @RequirePermissions("settings:manage")
  @Put("general")
  @ZodResponse({ status: 200, type: AdminSiteSettingsDto })
  general(
    @Body() b: AdminGeneralSettingsDto,
    @CurrentAuth() a: AuthContext,
    @Req() r: FastifyRequest,
  ) {
    return this.settings.saveGeneral(b, a, ip(r));
  }

  @RequirePermissions("settings:manage")
  @Put("announcement")
  @ZodResponse({ status: 200, type: AdminSiteSettingsDto })
  announcement(
    @Body() b: AdminAnnouncementDto,
    @CurrentAuth() a: AuthContext,
    @Req() r: FastifyRequest,
  ) {
    return this.settings.saveAnnouncement(b, a, ip(r));
  }

  @RequirePermissions("settings:manage")
  @Put("booking")
  @ZodResponse({ status: 200, type: AdminSiteSettingsDto })
  booking(
    @Body() b: AdminBookingSettingsDto,
    @CurrentAuth() a: AuthContext,
    @Req() r: FastifyRequest,
  ) {
    return this.settings.saveBooking(b, a, ip(r));
  }

  @RequirePermissions("settings:secrets")
  @Put("payments")
  @ZodResponse({ status: 200, type: AdminSiteSettingsDto })
  payments(
    @Body() b: AdminPaymentSettingsDto,
    @CurrentAuth() a: AuthContext,
    @Req() r: FastifyRequest,
  ) {
    return this.settings.savePayments(b, a, ip(r));
  }

  @RequirePermissions("settings:secrets")
  @Put("email")
  @ZodResponse({ status: 200, type: AdminSiteSettingsDto })
  emailSettings(
    @Body() b: AdminEmailSettingsDto,
    @CurrentAuth() a: AuthContext,
    @Req() r: FastifyRequest,
  ) {
    return this.settings.saveEmail(b, a, ip(r));
  }

  /** Sends a test message to the signed-in owner with the current email settings. */
  @RequirePermissions("settings:secrets")
  @Post("email/test")
  @HttpCode(200)
  @ZodResponse({ status: 200, type: AdminEmailTestDto })
  async emailTest(@CurrentAuth() a: AuthContext) {
    const status = await this.email.send({
      to: a.user.email,
      template: "settings-test",
      subject: "Pegah email test",
      text: "This is a test message from the Pegah console. Email sending works.",
      html: "<p>This is a test message from the Pegah console. Email sending works.</p>",
    });
    return { status, to: a.user.email };
  }
}

/** Contact details and the announcement banner for the public website. */
@ApiTags("site")
@Public()
@Controller("site")
export class PublicSiteController {
  constructor(@Inject(IntegrationSettings) private readonly settings: IntegrationSettings) {}

  @Get()
  @ZodResponse({ status: 200, type: PublicSiteDto })
  get(@Res({ passthrough: true }) reply: FastifyReply) {
    void reply.header("cache-control", "public, max-age=30, stale-while-revalidate=60");
    return this.settings.publicSite();
  }
}
