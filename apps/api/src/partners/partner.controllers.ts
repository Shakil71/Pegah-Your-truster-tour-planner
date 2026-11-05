import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import { ApiBody, ApiCookieAuth, ApiHeader, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import {
  AgentStatementSchema,
  CalendarQuerySchema,
  CalendarUpdateResultSchema,
  CalendarUpdateSchema,
  CreateBookingRequestSchema,
  CreatePartnerSchema,
  IDEMPOTENCY_HEADER,
  PaginationQuerySchema,
  PartnerBookingListSchema,
  PartnerListSchema,
  PartnerMemberInputSchema,
  PartnerOverviewSchema,
  PartnerOwnershipSchema,
  PartnerViewSchema,
  PaymentSessionResponseSchema,
  PublicIdSchema,
  RoomCalendarSchema,
  StatementQuerySchema,
  UpdateDepartureSchema,
  UpdatePartnerSchema,
  AdminDepartureSchema,
  type CreateBookingRequest,
} from "@pegah/contracts";
import type { FastifyReply, FastifyRequest } from "fastify";
import { createZodDto, ZodResponse, ZodValidationPipe } from "nestjs-zod";
import { z } from "zod";
import type { AuthContext } from "../auth/auth.types";
import { CurrentAuth, PartnerPortal, RequirePermissions } from "../auth/decorators";
import { BookingCreateService } from "../booking/booking-create.service";
import { BookingQueryService } from "../booking/booking-query.service";
import { BookingDetailDto, CreateBookingRequestDto } from "../booking/booking.dto";
import { CatalogAdminService } from "../catalog-admin/catalog-admin.service";
import { ProblemException } from "../common/problem";
import { IdempotencyService, parseIdempotencyKey } from "../idempotency/idempotency.service";
import { PaymentService } from "../payments/payment.service";
import { PartnerService } from "./partner.service";

class PartnerOverviewDto extends createZodDto(PartnerOverviewSchema) {}
class PartnerBookingListDto extends createZodDto(PartnerBookingListSchema) {}
class PartnerPageQueryDto extends createZodDto(PaginationQuerySchema) {}
class PartnerCalendarQueryDto extends createZodDto(CalendarQuerySchema) {}
class PartnerCalendarUpdateDto extends createZodDto(CalendarUpdateSchema) {}
class PartnerRoomCalendarDto extends createZodDto(RoomCalendarSchema) {}
class PartnerCalendarResultDto extends createZodDto(CalendarUpdateResultSchema) {}
class PartnerDepartureUpdateDto extends createZodDto(UpdateDepartureSchema) {}
class PartnerDepartureResultDto extends createZodDto(
  z.object({ departure: AdminDepartureSchema }),
) {}
class AgentStatementDto extends createZodDto(AgentStatementSchema) {}
class StatementQueryDto extends createZodDto(StatementQuerySchema) {}
class PartnerPaymentSessionDto extends createZodDto(PaymentSessionResponseSchema) {}
class AdminPartnerListDto extends createZodDto(PartnerListSchema) {}
class AdminPartnerResultDto extends createZodDto(z.object({ partner: PartnerViewSchema })) {}
class AdminCreatePartnerDto extends createZodDto(CreatePartnerSchema) {}
class AdminUpdatePartnerDto extends createZodDto(UpdatePartnerSchema) {}
class AdminPartnerMemberDto extends createZodDto(PartnerMemberInputSchema) {}
class AdminPartnerOwnershipDto extends createZodDto(PartnerOwnershipSchema) {}
class AdminMemberStatusDto extends createZodDto(
  z.object({ status: z.enum(["ACTIVE", "DISABLED"]) }),
) {}

const pid = (v: string, what: string) => {
  const p = PublicIdSchema.safeParse(v);
  if (!p.success) throw new ProblemException(404, `${what}-not-found`, "Not found");
  return p.data;
};
const ip = (r: FastifyRequest) => r.ip ?? null;
const noStore = (reply: FastifyReply) => void reply.header("cache-control", "no-store");

/** Supplier and agent portal. Every call is scoped to the signed-in partner. */
@ApiTags("partner-portal")
@ApiCookieAuth("partner")
@PartnerPortal()
@Controller("partner")
export class PartnerPortalController {
  constructor(
    @Inject(PartnerService) private readonly partners: PartnerService,
    @Inject(CatalogAdminService) private readonly catalog: CatalogAdminService,
    @Inject(BookingCreateService) private readonly creator: BookingCreateService,
    @Inject(BookingQueryService) private readonly bookings: BookingQueryService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService,
    @Inject(PaymentService) private readonly payments: PaymentService,
  ) {}

  @Get("overview")
  @ZodResponse({ status: 200, type: PartnerOverviewDto })
  overview(@CurrentAuth() auth: AuthContext, @Res({ passthrough: true }) reply: FastifyReply) {
    noStore(reply);
    return this.partners.overview(auth);
  }

  // Supplier
  @Get("reservations")
  @ZodResponse({ status: 200, type: PartnerBookingListDto })
  reservations(
    @CurrentAuth() auth: AuthContext,
    @Query() q: PartnerPageQueryDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    noStore(reply);
    return this.partners.reservations(auth, q.cursor, q.limit);
  }

  @Get("rooms/:id/calendar")
  @ZodResponse({ status: 200, type: PartnerRoomCalendarDto })
  async calendar(
    @CurrentAuth() auth: AuthContext,
    @Param("id") id: string,
    @Query() q: PartnerCalendarQueryDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    noStore(reply);
    const roomId = pid(id, "room");
    await this.partners.assertOwnsRoom(auth, roomId);
    return this.catalog.calendar(roomId, q);
  }

  @Put("rooms/:id/calendar")
  @ZodResponse({ status: 200, type: PartnerCalendarResultDto })
  async updateCalendar(
    @CurrentAuth() auth: AuthContext,
    @Param("id") id: string,
    @Body() body: PartnerCalendarUpdateDto,
    @Req() r: FastifyRequest,
  ) {
    const roomId = pid(id, "room");
    await this.partners.assertOwnsRoom(auth, roomId);
    return this.catalog.updateCalendar(roomId, body, auth, ip(r));
  }

  @Patch("departures/:id")
  @ZodResponse({ status: 200, type: PartnerDepartureResultDto })
  async updateDeparture(
    @CurrentAuth() auth: AuthContext,
    @Param("id") id: string,
    @Body() body: PartnerDepartureUpdateDto,
    @Req() r: FastifyRequest,
  ) {
    const depId = pid(id, "departure");
    await this.partners.assertOwnsDeparture(auth, depId);
    return { departure: await this.catalog.updateDeparture(depId, body, auth, ip(r)) };
  }

  // Agent
  @Get("bookings")
  @ZodResponse({ status: 200, type: PartnerBookingListDto })
  agentBookings(
    @CurrentAuth() auth: AuthContext,
    @Query() q: PartnerPageQueryDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    noStore(reply);
    return this.partners.agentBookings(auth, q.cursor, q.limit);
  }

  /** An agent books for a client (same holds, locks and price checks as customers). */
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post("bookings")
  @HttpCode(201)
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiBody({ type: CreateBookingRequestDto })
  @ZodResponse({ status: 201, type: BookingDetailDto })
  async createBooking(
    @Body(new ZodValidationPipe(CreateBookingRequestSchema)) body: CreateBookingRequest,
    @CurrentAuth() auth: AuthContext,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const partner = this.partners.partnerOf(auth, "AGENT");
    const key = parseIdempotencyKey(request.headers[IDEMPOTENCY_HEADER]);
    const result = await this.idempotency.execute(
      { actorKey: auth.user.publicId, key, route: "POST /partner/bookings", body },
      async () => {
        const id = await this.creator.create(body, {
          userId: auth.user.id,
          userPublicId: auth.user.publicId,
          ipAddress: ip(request),
          agent: { partnerId: partner.id, commissionBps: partner.commissionBps },
        });
        return { status: 201, body: await this.bookings.detail(id, "CUSTOMER", auth.user.id) };
      },
    );
    void reply.status(result.status).header("cache-control", "no-store");
    if (result.replayed) void reply.header("idempotent-replayed", "true");
    return result.body;
  }

  @Get("bookings/:id")
  @ZodResponse({ status: 200, type: BookingDetailDto })
  async agentBooking(
    @CurrentAuth() auth: AuthContext,
    @Param("id") id: string,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    noStore(reply);
    const bookingId = pid(id, "booking");
    await this.partners.assertAgentBooking(auth, bookingId);
    return this.bookings.detail(bookingId, "CUSTOMER");
  }

  @Post("bookings/:id/payment-session")
  @HttpCode(201)
  @ZodResponse({ status: 201, type: PartnerPaymentSessionDto })
  async pay(@CurrentAuth() auth: AuthContext, @Param("id") id: string, @Req() r: FastifyRequest) {
    const bookingId = pid(id, "booking");
    await this.partners.assertAgentBooking(auth, bookingId);
    return this.payments.startSession(bookingId, auth.user, ip(r));
  }

  @Get("statement")
  @ZodResponse({ status: 200, type: AgentStatementDto })
  statement(
    @CurrentAuth() auth: AuthContext,
    @Query() q: StatementQueryDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    noStore(reply);
    return this.partners.statement(auth, q.month);
  }
}

@ApiTags("admin-partners")
@ApiCookieAuth("staff")
@Controller("admin/partners")
export class AdminPartnersController {
  constructor(@Inject(PartnerService) private readonly partners: PartnerService) {}

  @RequirePermissions("partner:manage")
  @Get()
  @ZodResponse({ status: 200, type: AdminPartnerListDto })
  async list(@Res({ passthrough: true }) reply: FastifyReply) {
    noStore(reply);
    return { items: await this.partners.list() };
  }

  @RequirePermissions("partner:manage")
  @Post()
  @ZodResponse({ status: 201, type: AdminPartnerResultDto })
  async create(
    @Body() body: AdminCreatePartnerDto,
    @CurrentAuth() a: AuthContext,
    @Req() r: FastifyRequest,
  ) {
    return { partner: await this.partners.create(body, a, ip(r)) };
  }

  @RequirePermissions("partner:manage")
  @Put(":id")
  @ZodResponse({ status: 200, type: AdminPartnerResultDto })
  async update(
    @Param("id") id: string,
    @Body() body: AdminUpdatePartnerDto,
    @CurrentAuth() a: AuthContext,
    @Req() r: FastifyRequest,
  ) {
    return { partner: await this.partners.update(pid(id, "partner"), body, a, ip(r)) };
  }

  @RequirePermissions("partner:manage")
  @Post(":id/members")
  @ZodResponse({ status: 201, type: AdminPartnerResultDto })
  async addMember(
    @Param("id") id: string,
    @Body() body: AdminPartnerMemberDto,
    @CurrentAuth() a: AuthContext,
    @Req() r: FastifyRequest,
  ) {
    return { partner: await this.partners.addMember(pid(id, "partner"), body, a, ip(r)) };
  }

  @RequirePermissions("partner:manage")
  @Patch(":id/members/:memberId")
  @ZodResponse({ status: 200, type: AdminPartnerResultDto })
  async memberStatus(
    @Param("id") id: string,
    @Param("memberId") memberId: string,
    @Body() body: AdminMemberStatusDto,
    @CurrentAuth() a: AuthContext,
    @Req() r: FastifyRequest,
  ) {
    return {
      partner: await this.partners.setMemberStatus(
        pid(id, "partner"),
        pid(memberId, "member"),
        body.status,
        a,
        ip(r),
      ),
    };
  }

  @RequirePermissions("partner:manage")
  @Put(":id/ownership")
  @ZodResponse({ status: 200, type: AdminPartnerResultDto })
  async ownership(
    @Param("id") id: string,
    @Body() body: AdminPartnerOwnershipDto,
    @CurrentAuth() a: AuthContext,
    @Req() r: FastifyRequest,
  ) {
    return { partner: await this.partners.setOwnership(pid(id, "partner"), body, a, ip(r)) };
  }
}
