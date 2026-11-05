import { Controller, Get, Inject, Res } from "@nestjs/common";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { SystemSettingsSchema, type SystemSettings } from "@pegah/contracts";
import type { FastifyReply } from "fastify";
import { createZodDto, ZodResponse } from "nestjs-zod";
import { RequirePermissions } from "../auth/decorators";
import { APP_CONFIG, type AppConfig } from "../config/config";
import { BUILD, VERSION } from "../health/health.controller";
import { PRISMA, type Db } from "../prisma/prisma.service";

class AdminSystemSettingsDto extends createZodDto(SystemSettingsSchema) {}

/**
 * Read-only system status for the console. Configuration lives in the
 * server's environment files (changed by the operator, never from the web);
 * this shows what is switched on, without any secret values.
 */
@ApiTags("admin")
@ApiCookieAuth("staff")
@Controller("admin/settings")
export class AdminSettingsController {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(PRISMA) private readonly db: Db,
  ) {}

  @RequirePermissions("settings:read")
  @Get()
  @ZodResponse({ status: 200, type: AdminSystemSettingsDto })
  async get(@Res({ passthrough: true }) reply: FastifyReply): Promise<SystemSettings> {
    void reply.header("cache-control", "no-store");
    const c = this.config;
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
    const sslcommerz = c.PAYMENT_PROVIDER === "sslcommerz";
    return {
      environment: c.NODE_ENV,
      version: VERSION,
      commit: BUILD.commit,
      builtAt: BUILD.builtAt,
      database,
      payments: {
        provider: c.PAYMENT_PROVIDER,
        mode: sslcommerz ? c.SSLCOMMERZ_MODE : null,
        liveApproved: c.SSLCOMMERZ_LIVE_APPROVED,
        credentialsSet: Boolean(c.SSLCOMMERZ_STORE_ID && c.SSLCOMMERZ_STORE_PASSWORD),
        publicBaseUrl: c.PUBLIC_BASE_URL ?? null,
        holdExtensionMinutes: c.PAYMENT_HOLD_EXTENSION_MINUTES,
      },
      email: {
        transport: c.EMAIL_TRANSPORT,
        from: c.EMAIL_FROM,
        smtpHost: c.EMAIL_TRANSPORT === "smtp" ? (c.SMTP_HOST ?? null) : null,
        queued,
        failed,
      },
      booking: { holdMinutes: c.BOOKING_HOLD_MINUTES, holdSweepSeconds: c.HOLD_SWEEP_SECONDS },
      sessions: {
        customerTtlMinutes: c.CUSTOMER_SESSION_TTL_MIN,
        customerIdleMinutes: c.CUSTOMER_SESSION_IDLE_MIN,
        staffTtlMinutes: c.STAFF_SESSION_TTL_MIN,
        staffIdleMinutes: c.STAFF_SESSION_IDLE_MIN,
      },
    };
  }
}
