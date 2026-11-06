import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import {
  AdminRefundListQuerySchema,
  AdminRefundListSchema,
  CancellationDecisionSchema,
  CancellationRequestSchema,
  ChangePasswordSchema,
  MarkRefundPaidSchema,
  PasswordResetConfirmSchema,
  PasswordResetRequestSchema,
  ProfileSchema,
  PublicIdSchema,
  TravellerInputSchema,
  TravellerListSchema,
  TravellerSchema,
  UpdateProfileSchema,
  VerifyEmailSchema,
} from "@pegah/contracts";
import type { Prisma } from "@pegah/db";
import type { FastifyReply, FastifyRequest } from "fastify";
import { createZodDto, ZodResponse } from "nestjs-zod";
import { z } from "zod";
import type { AuthContext } from "../auth/auth.types";
import { CurrentAuth, Public, RequirePermissions } from "../auth/decorators";
import { BookingQueryService } from "../booking/booking-query.service";
import { BookingDetailDto } from "../booking/booking.dto";
import { decodeCursor, encodeCursor } from "../booking/booking.mappers";
import { toMoney } from "../common/money";
import { ProblemException } from "../common/problem";
import { PRISMA, type Db } from "../prisma/prisma.service";
import { AccountService } from "./account.service";
import { EmailVerificationService } from "./email-verification.service";
import { CancellationService } from "./cancellation.service";

class ProfileDto extends createZodDto(ProfileSchema) {}
class UpdateProfileDto extends createZodDto(UpdateProfileSchema) {}
class ChangePasswordDto extends createZodDto(ChangePasswordSchema) {}
class PasswordResetRequestDto extends createZodDto(PasswordResetRequestSchema) {}
class PasswordResetConfirmDto extends createZodDto(PasswordResetConfirmSchema) {}
class VerifyEmailDto extends createZodDto(VerifyEmailSchema) {}
class TravellerInputDto extends createZodDto(TravellerInputSchema) {}
class TravellerListDto extends createZodDto(TravellerListSchema) {}
class TravellerResultDto extends createZodDto(z.object({ traveller: TravellerSchema })) {}
class CancellationRequestDto extends createZodDto(CancellationRequestSchema) {}
class CancellationDecisionDto extends createZodDto(CancellationDecisionSchema) {}
class MarkRefundPaidDto extends createZodDto(MarkRefundPaidSchema) {}
class AdminRefundListQueryDto extends createZodDto(AdminRefundListQuerySchema) {}
class AdminRefundListDto extends createZodDto(AdminRefundListSchema) {}

const pid = (v: string, what: string) => {
  const p = PublicIdSchema.safeParse(v);
  if (!p.success) throw new ProblemException(404, `${what}-not-found`, "Not found");
  return p.data;
};
const ip = (r: FastifyRequest) => r.ip ?? null;
const noStore = (reply: FastifyReply) => void reply.header("cache-control", "no-store");

@ApiTags("account")
@ApiCookieAuth("customer")
@Controller("me")
export class AccountController {
  constructor(
    @Inject(AccountService) private readonly account: AccountService,
    @Inject(CancellationService) private readonly cancellations: CancellationService,
    @Inject(BookingQueryService) private readonly bookings: BookingQueryService,
    @Inject(EmailVerificationService) private readonly verification: EmailVerificationService,
  ) {}

  @Get("profile")
  @ZodResponse({ status: 200, type: ProfileDto })
  profile(@CurrentAuth() auth: AuthContext, @Res({ passthrough: true }) reply: FastifyReply) {
    noStore(reply);
    return this.account.profile(auth.user.id);
  }

  @Put("profile")
  @ZodResponse({ status: 200, type: ProfileDto })
  updateProfile(
    @CurrentAuth() auth: AuthContext,
    @Body() body: UpdateProfileDto,
    @Req() r: FastifyRequest,
  ) {
    return this.account.updateProfile(auth, body, ip(r));
  }

  /** Emails a new verification link (ADR-0035). */
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post("email-verification")
  @HttpCode(202)
  async sendVerification(@CurrentAuth() auth: AuthContext, @Req() r: FastifyRequest) {
    await this.verification.send(auth.user.id, ip(r));
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("password")
  @HttpCode(204)
  async changePassword(
    @CurrentAuth() auth: AuthContext,
    @Body() body: ChangePasswordDto,
    @Req() r: FastifyRequest,
  ) {
    await this.account.changePassword(auth, body, ip(r));
  }

  @Get("travellers")
  @ZodResponse({ status: 200, type: TravellerListDto })
  async travellers(
    @CurrentAuth() auth: AuthContext,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    noStore(reply);
    return { items: await this.account.travellers(auth.user.id) };
  }

  @Post("travellers")
  @ZodResponse({ status: 201, type: TravellerResultDto })
  async addTraveller(@CurrentAuth() auth: AuthContext, @Body() body: TravellerInputDto) {
    return { traveller: await this.account.addTraveller(auth.user.id, body) };
  }

  @Put("travellers/:id")
  @ZodResponse({ status: 200, type: TravellerResultDto })
  async updateTraveller(
    @CurrentAuth() auth: AuthContext,
    @Param("id") id: string,
    @Body() body: TravellerInputDto,
  ) {
    return {
      traveller: await this.account.updateTraveller(auth.user.id, pid(id, "traveller"), body),
    };
  }

  @Delete("travellers/:id")
  @HttpCode(204)
  async deleteTraveller(@CurrentAuth() auth: AuthContext, @Param("id") id: string) {
    await this.account.deleteTraveller(auth.user.id, pid(id, "traveller"));
  }

  /** Asks to cancel a confirmed booking; staff decide under the cancellation policy. */
  @Post("bookings/:id/cancellation-request")
  @HttpCode(200)
  @ZodResponse({ status: 200, type: BookingDetailDto })
  async requestCancellation(
    @CurrentAuth() auth: AuthContext,
    @Param("id") id: string,
    @Body() body: CancellationRequestDto,
    @Req() r: FastifyRequest,
  ) {
    const bookingId = pid(id, "booking");
    await this.cancellations.request(bookingId, auth, body.reason, ip(r));
    return this.bookings.detail(bookingId, "CUSTOMER", auth.user.id);
  }
}

@ApiTags("auth")
@Public()
@Controller("auth/password-reset")
export class PasswordResetController {
  constructor(@Inject(AccountService) private readonly account: AccountService) {}

  /** Always 202: the response never reveals whether the email is registered. */
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("request")
  @HttpCode(202)
  async request(@Body() body: PasswordResetRequestDto, @Req() r: FastifyRequest) {
    await this.account.requestPasswordReset(body.email, ip(r));
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("confirm")
  @HttpCode(204)
  async confirm(@Body() body: PasswordResetConfirmDto, @Req() r: FastifyRequest) {
    await this.account.confirmPasswordReset(body, ip(r));
  }
}

@ApiTags("auth")
@Public()
@Controller("auth/verify-email")
export class VerifyEmailController {
  constructor(
    @Inject(EmailVerificationService) private readonly verification: EmailVerificationService,
  ) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  @HttpCode(204)
  async verify(@Body() body: VerifyEmailDto, @Req() r: FastifyRequest) {
    await this.verification.verify(body.token, ip(r));
  }
}

@ApiTags("admin")
@ApiCookieAuth("staff")
@Controller("admin")
export class AdminRefundsController {
  constructor(
    @Inject(CancellationService) private readonly cancellations: CancellationService,
    @Inject(BookingQueryService) private readonly bookings: BookingQueryService,
    @Inject(PRISMA) private readonly db: Db,
  ) {}

  @RequirePermissions("booking:read", "booking:override_status")
  @Post("bookings/:id/cancellation-decision")
  @HttpCode(200)
  @ZodResponse({ status: 200, type: BookingDetailDto })
  async decide(
    @Param("id") id: string,
    @Body() body: CancellationDecisionDto,
    @CurrentAuth() auth: AuthContext,
    @Req() r: FastifyRequest,
  ) {
    const bookingId = pid(id, "booking");
    await this.cancellations.decide(bookingId, body, auth, ip(r));
    return this.bookings.detail(bookingId, "STAFF");
  }

  @RequirePermissions("payment:read")
  @Get("refunds")
  @ZodResponse({ status: 200, type: AdminRefundListDto })
  async list(@Query() q: AdminRefundListQueryDto, @Res({ passthrough: true }) reply: FastifyReply) {
    noStore(reply);
    const where: Prisma.RefundWhereInput = {};
    if (q.status) where.status = q.status;
    const before = decodeCursor(q.cursor);
    if (before !== undefined) where.id = { lt: before };
    const rows = await this.db.refund.findMany({
      where,
      orderBy: { id: "desc" },
      take: q.limit + 1,
      include: {
        booking: { select: { publicId: true, reference: true, contactName: true } },
        giftCard: { select: { last4: true } },
      },
    });
    const page = rows.slice(0, q.limit);
    return {
      items: page.map((x) => ({
        id: x.publicId,
        amount: toMoney(x.amountMinor, x.currency),
        status: x.status,
        reason: x.reason,
        providerRef: x.providerRef,
        giftCardLast4: x.giftCard?.last4 ?? null,
        createdAt: x.createdAt.toISOString(),
        paidAt: x.paidAt?.toISOString() ?? null,
        bookingId: x.booking.publicId,
        bookingReference: x.booking.reference,
        customerName: x.booking.contactName,
      })),
      nextCursor:
        rows.length > q.limit && page.length > 0 ? encodeCursor(page[page.length - 1]!.id) : null,
    };
  }

  /** Records that finance returned the money (refund:approve). */
  @RequirePermissions("refund:approve")
  @Post("refunds/:id/paid")
  @HttpCode(204)
  async markPaid(
    @Param("id") id: string,
    @Body() body: MarkRefundPaidDto,
    @CurrentAuth() auth: AuthContext,
    @Req() r: FastifyRequest,
  ) {
    await this.cancellations.markRefundPaid(pid(id, "refund"), body.providerRef, auth, ip(r));
  }
}
