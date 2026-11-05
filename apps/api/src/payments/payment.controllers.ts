import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import { ApiCookieAuth, ApiExcludeEndpoint, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import {
  AdminPaymentListQuerySchema,
  AdminPaymentListResponseSchema,
  PaymentSessionResponseSchema,
  PublicIdSchema,
} from "@pegah/contracts";
import type { Prisma } from "@pegah/db";
import type { FastifyReply, FastifyRequest } from "fastify";
import { createZodDto, ZodResponse } from "nestjs-zod";
import type { AuthContext } from "../auth/auth.types";
import { CurrentAuth, Public, RequirePermissions, SkipOriginCheck } from "../auth/decorators";
import { decodeCursor, encodeCursor } from "../booking/booking.mappers";
import { toMoney } from "../common/money";
import { ProblemException } from "../common/problem";
import { APP_CONFIG, type AppConfig } from "../config/config";
import { PRISMA, type Db } from "../prisma/prisma.service";
import { PaymentService, type CallbackResult } from "./payment.service";
import { IntegrationSettings } from "../settings/integration-settings.service";
import { formatDecimal } from "./provider";
import { SimulatorProvider } from "./simulator.provider";

class PaymentSessionResponseDto extends createZodDto(PaymentSessionResponseSchema) {}
class AdminPaymentListQueryDto extends createZodDto(AdminPaymentListQuerySchema) {}
class AdminPaymentListResponseDto extends createZodDto(AdminPaymentListResponseSchema) {}

const RETURN_RESULTS = new Set(["success", "fail", "cancel"]);

function bookingId(id: string): string {
  const parsed = PublicIdSchema.safeParse(id);
  if (!parsed.success) throw new ProblemException(404, "booking-not-found", "Booking not found");
  return parsed.data;
}

/** Where the customer lands after the payment page (a top-level GET, so their session cookie is sent). */
function landing(config: AppConfig, result: CallbackResult): string {
  const base = (config.PUBLIC_BASE_URL ?? "").replace(/\/$/, "");
  if (!result.bookingPublicId) return `${base}/account/bookings?payment=unknown`;
  const area = result.viaAgent ? "partner" : "account";
  return `${base}/${area}/bookings/${result.bookingPublicId}?payment=${result.outcome}`;
}

@ApiTags("payments")
@ApiCookieAuth("customer")
@Controller("me/bookings")
export class MyPaymentsController {
  constructor(@Inject(PaymentService) private readonly payments: PaymentService) {}

  /** Opens a hosted payment page for an unpaid booking. Send the browser to `redirectUrl`. */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(":id/payment-session")
  @HttpCode(201)
  @ZodResponse({ status: 201, type: PaymentSessionResponseDto })
  start(@Param("id") id: string, @CurrentAuth() auth: AuthContext, @Req() request: FastifyRequest) {
    return this.payments.startSession(bookingId(id), auth.user, request.ip ?? null);
  }
}

/**
 * Provider callbacks. They come from the provider's servers (IPN) or as a
 * cross-site form POST from the customer's browser (return URLs), so there is
 * no session, no CSRF token and a foreign Origin. Authenticity comes from
 * verifying every outcome with the provider server-to-server.
 */
@ApiTags("payments")
@Public()
@SkipOriginCheck()
@Controller("payments")
export class PaymentCallbacksController {
  constructor(
    @Inject(PaymentService) private readonly payments: PaymentService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @ApiExcludeEndpoint()
  @Post("sslcommerz/ipn")
  @HttpCode(200)
  async ipn(@Body() body: unknown, @Res() reply: FastifyReply) {
    this.assertProvider("sslcommerz");
    await this.payments.handleCallback("ipn", asFields(body));
    // Always 200 once recorded, so the provider stops retrying.
    void reply.type("text/plain").send("OK");
  }

  @ApiExcludeEndpoint()
  @Post("sslcommerz/return/:result")
  async sslcommerzReturn(
    @Param("result") result: string,
    @Body() body: unknown,
    @Res() reply: FastifyReply,
  ) {
    this.assertProvider("sslcommerz");
    if (!RETURN_RESULTS.has(result)) throw new ProblemException(404, "not-found", "Not found");
    const outcome = await this.payments.handleCallback(
      result as "success" | "fail" | "cancel",
      asFields(body),
    );
    void reply.redirect(landing(this.config, outcome), 303);
  }

  private assertProvider(name: string) {
    if (this.payments.providerName !== name) {
      throw new ProblemException(404, "not-found", "Not found");
    }
  }
}

/** Development/test-only payment page. 404 unless PAYMENT_PROVIDER=simulator (never in production). */
@ApiTags("payments")
@Public()
@SkipOriginCheck()
@Controller("payments/simulator")
export class SimulatorController {
  constructor(
    @Inject(IntegrationSettings) private readonly integrations: IntegrationSettings,
    @Inject(PaymentService) private readonly payments: PaymentService,
    @Inject(PRISMA) private readonly db: Db,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private sim(tranId: string): SimulatorProvider {
    const p = this.integrations.paymentProvider();
    if (
      !(p instanceof SimulatorProvider) ||
      !PublicIdSchema.safeParse(tranId).success ||
      !p.has(tranId)
    ) {
      throw new ProblemException(404, "not-found", "Not found");
    }
    return p;
  }

  @ApiExcludeEndpoint()
  @Get(":tranId")
  async page(@Param("tranId") tranId: string, @Res() reply: FastifyReply) {
    this.sim(tranId);
    const payment = await this.db.payment.findFirst({
      where: { providerTxnId: tranId },
      include: { booking: { select: { reference: true, productName: true } } },
    });
    const amount = payment ? formatDecimal(payment.amountMinor) : "?";
    const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
    const button = (outcome: string, label: string) =>
      `<form method="post" action="/api/v1/payments/simulator/${tranId}/${outcome}"><button>${label}</button></form>`;
    void reply.type("text/html; charset=utf-8").send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Payment simulator</title></head><body>
<h1>Payment simulator (development only)</h1>
<p>No money moves. This page stands in for the provider's hosted checkout.</p>
<p>Booking <b>${esc(payment?.booking.reference ?? "?")}</b> — ${esc(payment?.booking.productName ?? "")}<br>
Amount: <b>${esc(payment?.currency ?? "BDT")} ${amount}</b></p>
${button("success", "Pay successfully")}${button("fail", "Payment fails")}${button("cancel", "Cancel")}
</body></html>`);
  }

  @ApiExcludeEndpoint()
  @Post(":tranId/:outcome")
  async complete(
    @Param("tranId") tranId: string,
    @Param("outcome") outcome: string,
    @Res() reply: FastifyReply,
  ) {
    const sim = this.sim(tranId);
    if (!RETURN_RESULTS.has(outcome)) throw new ProblemException(404, "not-found", "Not found");
    const o = outcome as "success" | "fail" | "cancel";
    const valId = sim.complete(tranId, o);
    // Same path a real provider's browser return takes.
    const result = await this.payments.handleCallback(o, {
      tran_id: tranId,
      ...(o === "success"
        ? { val_id: valId, status: "VALID" }
        : { status: o === "fail" ? "FAILED" : "CANCELLED" }),
    });
    void reply.redirect(landing(this.config, result), 303);
  }
}

@ApiTags("admin")
@ApiCookieAuth("staff")
@Controller("admin/payments")
export class AdminPaymentsController {
  constructor(@Inject(PRISMA) private readonly db: Db) {}

  @RequirePermissions("payment:read")
  @Get()
  @ZodResponse({ status: 200, type: AdminPaymentListResponseDto })
  async list(
    @Query() q: AdminPaymentListQueryDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    void reply.header("cache-control", "no-store");
    const where: Prisma.PaymentWhereInput = {};
    if (q.status) where.status = q.status;
    const before = decodeCursor(q.cursor);
    if (before !== undefined) where.id = { lt: before };
    const rows = await this.db.payment.findMany({
      where,
      orderBy: { id: "desc" },
      take: q.limit + 1,
      include: { booking: { select: { publicId: true, reference: true } } },
    });
    const page = rows.slice(0, q.limit);
    return {
      items: page.map((p) => ({
        id: p.publicId,
        provider: p.provider,
        status: p.status,
        amount: toMoney(p.amountMinor, p.currency),
        method: p.method,
        failureReason: p.failureReason,
        createdAt: p.createdAt.toISOString(),
        succeededAt: p.succeededAt?.toISOString() ?? null,
        bookingId: p.booking.publicId,
        bookingReference: p.booking.reference,
        providerTxnId: p.providerTxnId,
        bankTxnId: p.bankTxnId,
        riskLevel: p.riskLevel,
      })),
      nextCursor:
        rows.length > q.limit && page.length > 0 ? encodeCursor(page[page.length - 1]!.id) : null,
    };
  }
}

/** Form-urlencoded or JSON callback body → plain record of strings. */
function asFields(body: unknown): Record<string, unknown> {
  return typeof body === "object" && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
}
