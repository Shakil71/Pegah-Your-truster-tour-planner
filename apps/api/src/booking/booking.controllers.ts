import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query, Req } from "@nestjs/common";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { PublicIdSchema } from "@pegah/contracts";
import type { FastifyRequest } from "fastify";
import { ZodResponse } from "nestjs-zod";
import type { AuthContext } from "../auth/auth.types";
import { CurrentAuth, RequirePermissions } from "../auth/decorators";
import { ProblemException } from "../common/problem";
import { BookingQueryService } from "./booking-query.service";
import { BookingStatusService } from "./booking-status.service";
import {
  AdminBookingListQueryDto,
  BookingDetailDto,
  BookingListResponseDto,
  BookingStatusTransitionRequestDto,
  PaginationQueryDto,
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
  constructor(@Inject(BookingQueryService) private readonly bookings: BookingQueryService) {}

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
