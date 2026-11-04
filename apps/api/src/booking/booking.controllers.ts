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
import { ApiBody, ApiCookieAuth, ApiHeader, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import {
  CreateBookingRequestSchema,
  IDEMPOTENCY_HEADER,
  PublicIdSchema,
  type CreateBookingRequest,
} from "@pegah/contracts";
import type { FastifyReply, FastifyRequest } from "fastify";
import { ZodResponse, ZodValidationPipe } from "nestjs-zod";
import type { AuthContext } from "../auth/auth.types";
import { CurrentAuth, Public, RequirePermissions } from "../auth/decorators";
import { ProblemException } from "../common/problem";
import { IdempotencyService, parseIdempotencyKey } from "../idempotency/idempotency.service";
import { BookingCreateService } from "./booking-create.service";
import { BookingQueryService } from "./booking-query.service";
import { BookingStatusService } from "./booking-status.service";
import { QuoteService } from "./quote.service";
import {
  AdminBookingListQueryDto,
  BookingDetailDto,
  BookingListResponseDto,
  BookingStatusTransitionRequestDto,
  CancelBookingRequestDto,
  CreateBookingRequestDto,
  HotelQuoteQueryDto,
  PaginationQueryDto,
  QuoteDto,
  TourQuoteQueryDto,
} from "./booking.dto";

function parseBookingId(id: string): string {
  const parsed = PublicIdSchema.safeParse(id);
  if (!parsed.success) throw new ProblemException(404, "booking-not-found", "Booking not found");
  return parsed.data;
}

@ApiTags("admin-bookings")
@ApiCookieAuth("staff")
@Controller("admin/bookings")
export class AdminBookingsController {
  constructor(
    @Inject(BookingQueryService) private readonly bookings: BookingQueryService,
    @Inject(BookingStatusService) private readonly status: BookingStatusService,
  ) {}

  @RequirePermissions("booking:read")
  @Get()
  @ZodResponse({ status: 200, type: BookingListResponseDto })
  list(@Query() query: AdminBookingListQueryDto) {
    return this.bookings.listAll(query);
  }

  @RequirePermissions("booking:read")
  @Get(":id")
  @ZodResponse({ status: 200, type: BookingDetailDto })
  detail(@Param("id") id: string) {
    return this.bookings.detail(parseBookingId(id), "STAFF");
  }

  /** Manual status change by staff. Validated by the state machine and audited. */
  @RequirePermissions("booking:read", "booking:override_status")
  @Post(":id/status")
  @HttpCode(200)
  @ZodResponse({ status: 200, type: BookingDetailDto })
  async changeStatus(
    @Param("id") id: string,
    @Body() body: BookingStatusTransitionRequestDto,
    @CurrentAuth() auth: AuthContext,
    @Req() request: FastifyRequest,
  ) {
    const publicId = parseBookingId(id);
    await this.status.transition({
      bookingPublicId: publicId,
      to: body.to,
      expectedStatus: body.expectedStatus,
      actor: { type: "STAFF", userId: auth.user.id },
      reason: body.reason,
      ipAddress: request.ip,
    });
    return this.bookings.detail(publicId, "STAFF");
  }
}

@ApiTags("my-bookings")
@ApiCookieAuth("customer")
@Controller("me/bookings")
export class MyBookingsController {
  constructor(
    @Inject(BookingQueryService) private readonly bookings: BookingQueryService,
    @Inject(BookingStatusService) private readonly status: BookingStatusService,
  ) {}

  /** Cancels an unpaid booking and releases its hold. Paid bookings use a cancellation request (Phase 5). */
  @Post(":id/cancel")
  @HttpCode(200)
  @ZodResponse({ status: 200, type: BookingDetailDto })
  async cancel(
    @CurrentAuth() auth: AuthContext,
    @Param("id") id: string,
    @Body() body: CancelBookingRequestDto,
    @Req() request: FastifyRequest,
  ) {
    const publicId = parseBookingId(id);
    await this.status.transition({
      bookingPublicId: publicId,
      to: "CANCELLED",
      expectedStatus: "PENDING_PAYMENT",
      actor: { type: "CUSTOMER", userId: auth.user.id },
      reason: body.reason?.trim() || "Cancelled by the customer before payment",
      ipAddress: request.ip,
      ownerUserId: auth.user.id,
    });
    return this.bookings.detail(publicId, "CUSTOMER", auth.user.id);
  }

  @Get()
  @ZodResponse({ status: 200, type: BookingListResponseDto })
  list(@CurrentAuth() auth: AuthContext, @Query() query: PaginationQueryDto) {
    return this.bookings.listForUser(auth.user.id, query.cursor, query.limit);
  }

  @Get(":id")
  @ZodResponse({ status: 200, type: BookingDetailDto })
  detail(@CurrentAuth() auth: AuthContext, @Param("id") id: string) {
    return this.bookings.detail(parseBookingId(id), "CUSTOMER", auth.user.id);
  }
}

@ApiTags("bookings")
@ApiCookieAuth("customer")
@Controller("bookings")
export class BookingsController {
  constructor(
    @Inject(BookingCreateService) private readonly creator: BookingCreateService,
    @Inject(BookingQueryService) private readonly bookings: BookingQueryService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService,
  ) {}

  /**
   * Creates a booking and holds the inventory for BOOKING_HOLD_MINUTES.
   * Requires `Idempotency-Key`; a retry with the same key and body returns
   * the original response instead of creating a second booking.
   */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post()
  @HttpCode(201)
  @ApiHeader({ name: "Idempotency-Key", required: true, description: "16–128 characters" })
  @ApiBody({ type: CreateBookingRequestDto })
  @ZodResponse({ status: 201, type: BookingDetailDto })
  async create(
    @Body(new ZodValidationPipe(CreateBookingRequestSchema)) body: CreateBookingRequest,
    @CurrentAuth() auth: AuthContext,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const key = parseIdempotencyKey(request.headers[IDEMPOTENCY_HEADER]);
    const result = await this.idempotency.execute(
      { actorKey: auth.user.publicId, key, route: "POST /bookings", body },
      async () => {
        const id = await this.creator.create(body, {
          userId: auth.user.id,
          userPublicId: auth.user.publicId,
          ipAddress: request.ip ?? null,
        });
        return {
          status: 201,
          body: await this.bookings.detail(id, "CUSTOMER", auth.user.id),
        };
      },
    );
    void reply.status(result.status).header("cache-control", "no-store");
    if (result.replayed) void reply.header("idempotent-replayed", "true");
    return result.body;
  }
}

@ApiTags("bookings")
@Public()
@Controller("quotes")
export class QuotesController {
  constructor(@Inject(QuoteService) private readonly quotes: QuoteService) {}

  @Get("hotel")
  @ZodResponse({ status: 200, type: QuoteDto })
  hotel(
    @Query() query: HotelQuoteQueryDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    void reply.header("cache-control", "no-store");
    // Signed-in customers get per-customer promo limits checked too.
    return this.quotes.hotel(query, request.auth?.user.id ?? null);
  }

  @Get("tour")
  @ZodResponse({ status: 200, type: QuoteDto })
  tour(
    @Query() query: TourQuoteQueryDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    void reply.header("cache-control", "no-store");
    return this.quotes.tour(query, request.auth?.user.id ?? null);
  }
}
