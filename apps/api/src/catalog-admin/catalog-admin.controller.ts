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
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import {
  AdminDepartureSchema,
  AdminDestinationListSchema,
  AdminDestinationSchema,
  AdminHotelDetailSchema,
  AdminHotelListSchema,
  AdminRoomSchema,
  AdminTourDetailSchema,
  AdminTourListSchema,
  CalendarQuerySchema,
  CalendarUpdateResultSchema,
  CalendarUpdateSchema,
  CreateDepartureSchema,
  CreateDestinationSchema,
  CreateHotelSchema,
  CreateTourSchema,
  CustomerDetailSchema,
  CustomerListQuerySchema,
  CustomerListSchema,
  CustomerSignOutResultSchema,
  CustomerStatusUpdateSchema,
  DestinationInputSchema,
  HotelInputSchema,
  PublicIdSchema,
  RoomCalendarSchema,
  RoomInputSchema,
  SlugSchema,
  TourInputSchema,
  UpdateDepartureSchema,
} from "@pegah/contracts";
import type { FastifyReply, FastifyRequest } from "fastify";
import { createZodDto, ZodResponse } from "nestjs-zod";
import { z } from "zod";
import type { AuthContext } from "../auth/auth.types";
import { CurrentAuth, RequirePermissions } from "../auth/decorators";
import { ProblemException } from "../common/problem";
import { CatalogAdminService } from "./catalog-admin.service";
import { CustomerAdminService } from "./customer-admin.service";

// Request bodies
class AdminCreateDestinationDto extends createZodDto(CreateDestinationSchema) {}
class AdminDestinationInputDto extends createZodDto(DestinationInputSchema) {}
class AdminCreateHotelDto extends createZodDto(CreateHotelSchema) {}
class AdminHotelInputDto extends createZodDto(HotelInputSchema) {}
class AdminRoomInputDto extends createZodDto(RoomInputSchema) {}
class AdminCalendarQueryDto extends createZodDto(CalendarQuerySchema) {}
class AdminCalendarUpdateDto extends createZodDto(CalendarUpdateSchema) {}
class AdminCreateTourDto extends createZodDto(CreateTourSchema) {}
class AdminTourInputDto extends createZodDto(TourInputSchema) {}
class AdminCreateDepartureDto extends createZodDto(CreateDepartureSchema) {}
class AdminUpdateDepartureDto extends createZodDto(UpdateDepartureSchema) {}
class AdminCustomerListQueryDto extends createZodDto(CustomerListQuerySchema) {}

// Responses. Schemas that also appear nested are wrapped, so each named
// component exists once in the OpenAPI document.
class AdminDestinationListDto extends createZodDto(AdminDestinationListSchema) {}
class AdminDestinationResultDto extends createZodDto(
  z.object({ destination: AdminDestinationSchema }),
) {}
class AdminHotelListDto extends createZodDto(AdminHotelListSchema) {}
class AdminHotelDetailDto extends createZodDto(AdminHotelDetailSchema) {}
class AdminRoomResultDto extends createZodDto(z.object({ room: AdminRoomSchema })) {}
class AdminRoomCalendarDto extends createZodDto(RoomCalendarSchema) {}
class AdminCalendarUpdateResultDto extends createZodDto(CalendarUpdateResultSchema) {}
class AdminTourListDto extends createZodDto(AdminTourListSchema) {}
class AdminTourDetailDto extends createZodDto(AdminTourDetailSchema) {}
class AdminDepartureResultDto extends createZodDto(z.object({ departure: AdminDepartureSchema })) {}
class AdminCustomerListDto extends createZodDto(CustomerListSchema) {}
class AdminCustomerDetailDto extends createZodDto(CustomerDetailSchema) {}
class AdminCustomerStatusDto extends createZodDto(CustomerStatusUpdateSchema) {}
class AdminCustomerSignOutDto extends createZodDto(CustomerSignOutResultSchema) {}

function slug(value: string, what: string): string {
  const parsed = SlugSchema.safeParse(value);
  if (!parsed.success) throw new ProblemException(404, `${what}-not-found`, "Not found");
  return parsed.data;
}
function pid(value: string, what: string): string {
  const parsed = PublicIdSchema.safeParse(value);
  if (!parsed.success) throw new ProblemException(404, `${what}-not-found`, "Not found");
  return parsed.data;
}
const ip = (r: FastifyRequest) => r.ip ?? null;
const noStore = (reply: FastifyReply) => void reply.header("cache-control", "no-store");

@ApiTags("admin-catalog")
@ApiCookieAuth("staff")
@Controller("admin")
export class CatalogAdminController {
  constructor(
    @Inject(CatalogAdminService) private readonly catalog: CatalogAdminService,
    @Inject(CustomerAdminService) private readonly customers: CustomerAdminService,
  ) {}

  // Destinations
  @RequirePermissions("catalog:read")
  @Get("destinations")
  @ZodResponse({ status: 200, type: AdminDestinationListDto })
  async destinations(@Res({ passthrough: true }) reply: FastifyReply) {
    noStore(reply);
    return { items: await this.catalog.listDestinations() };
  }

  @RequirePermissions("catalog:manage")
  @Post("destinations")
  @ZodResponse({ status: 201, type: AdminDestinationResultDto })
  async createDestination(
    @Body() body: AdminCreateDestinationDto,
    @CurrentAuth() a: AuthContext,
    @Req() r: FastifyRequest,
  ) {
    return { destination: await this.catalog.createDestination(body, a, ip(r)) };
  }

  @RequirePermissions("catalog:manage")
  @Put("destinations/:slug")
  @ZodResponse({ status: 200, type: AdminDestinationResultDto })
  async updateDestination(
    @Param("slug") s: string,
    @Body() body: AdminDestinationInputDto,
    @CurrentAuth() a: AuthContext,
    @Req() r: FastifyRequest,
  ) {
    return {
      destination: await this.catalog.updateDestination(slug(s, "destination"), body, a, ip(r)),
    };
  }

  // Hotels and rooms
  @RequirePermissions("catalog:read")
  @Get("hotels")
  @ZodResponse({ status: 200, type: AdminHotelListDto })
  async hotels(@Res({ passthrough: true }) reply: FastifyReply) {
    noStore(reply);
    return { items: await this.catalog.listHotels() };
  }

  @RequirePermissions("catalog:manage")
  @Post("hotels")
  @ZodResponse({ status: 201, type: AdminHotelDetailDto })
  createHotel(
    @Body() body: AdminCreateHotelDto,
    @CurrentAuth() a: AuthContext,
    @Req() r: FastifyRequest,
  ) {
    return this.catalog.createHotel(body, a, ip(r));
  }

  @RequirePermissions("catalog:read")
  @Get("hotels/:slug")
  @ZodResponse({ status: 200, type: AdminHotelDetailDto })
  hotel(@Param("slug") s: string, @Res({ passthrough: true }) reply: FastifyReply) {
    noStore(reply);
    return this.catalog.hotel(slug(s, "hotel"));
  }

  @RequirePermissions("catalog:manage")
  @Put("hotels/:slug")
  @ZodResponse({ status: 200, type: AdminHotelDetailDto })
  updateHotel(
    @Param("slug") s: string,
    @Body() body: AdminHotelInputDto,
    @CurrentAuth() a: AuthContext,
    @Req() r: FastifyRequest,
  ) {
    return this.catalog.updateHotel(slug(s, "hotel"), body, a, ip(r));
  }

  @RequirePermissions("catalog:manage")
  @Post("hotels/:slug/rooms")
  @ZodResponse({ status: 201, type: AdminRoomResultDto })
  async createRoom(
    @Param("slug") s: string,
    @Body() body: AdminRoomInputDto,
    @CurrentAuth() a: AuthContext,
    @Req() r: FastifyRequest,
  ) {
    return { room: await this.catalog.createRoom(slug(s, "hotel"), body, a, ip(r)) };
  }

  @RequirePermissions("catalog:manage")
  @Put("rooms/:id")
  @ZodResponse({ status: 200, type: AdminRoomResultDto })
  async updateRoom(
    @Param("id") id: string,
    @Body() body: AdminRoomInputDto,
    @CurrentAuth() a: AuthContext,
    @Req() r: FastifyRequest,
  ) {
    return { room: await this.catalog.updateRoom(pid(id, "room"), body, a, ip(r)) };
  }

  @RequirePermissions("catalog:read")
  @Get("rooms/:id/calendar")
  @ZodResponse({ status: 200, type: AdminRoomCalendarDto })
  calendar(
    @Param("id") id: string,
    @Query() q: AdminCalendarQueryDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    noStore(reply);
    return this.catalog.calendar(pid(id, "room"), q);
  }

  @RequirePermissions("inventory:manage")
  @Put("rooms/:id/calendar")
  @ZodResponse({ status: 200, type: AdminCalendarUpdateResultDto })
  updateCalendar(
    @Param("id") id: string,
    @Body() body: AdminCalendarUpdateDto,
    @CurrentAuth() a: AuthContext,
    @Req() r: FastifyRequest,
  ) {
    return this.catalog.updateCalendar(pid(id, "room"), body, a, ip(r));
  }

  // Tours and departures
  @RequirePermissions("catalog:read")
  @Get("tours")
  @ZodResponse({ status: 200, type: AdminTourListDto })
  async tours(@Res({ passthrough: true }) reply: FastifyReply) {
    noStore(reply);
    return { items: await this.catalog.listTours() };
  }

  @RequirePermissions("catalog:manage")
  @Post("tours")
  @ZodResponse({ status: 201, type: AdminTourDetailDto })
  createTour(
    @Body() body: AdminCreateTourDto,
    @CurrentAuth() a: AuthContext,
    @Req() r: FastifyRequest,
  ) {
    return this.catalog.createTour(body, a, ip(r));
  }

  @RequirePermissions("catalog:read")
  @Get("tours/:slug")
  @ZodResponse({ status: 200, type: AdminTourDetailDto })
  tour(@Param("slug") s: string, @Res({ passthrough: true }) reply: FastifyReply) {
    noStore(reply);
    return this.catalog.tour(slug(s, "tour"));
  }

  @RequirePermissions("catalog:manage")
  @Put("tours/:slug")
  @ZodResponse({ status: 200, type: AdminTourDetailDto })
  updateTour(
    @Param("slug") s: string,
    @Body() body: AdminTourInputDto,
    @CurrentAuth() a: AuthContext,
    @Req() r: FastifyRequest,
  ) {
    return this.catalog.updateTour(slug(s, "tour"), body, a, ip(r));
  }

  @RequirePermissions("inventory:manage")
  @Post("tours/:slug/departures")
  @ZodResponse({ status: 201, type: AdminDepartureResultDto })
  async createDeparture(
    @Param("slug") s: string,
    @Body() body: AdminCreateDepartureDto,
    @CurrentAuth() a: AuthContext,
    @Req() r: FastifyRequest,
  ) {
    return { departure: await this.catalog.createDeparture(slug(s, "tour"), body, a, ip(r)) };
  }

  @RequirePermissions("inventory:manage")
  @Patch("departures/:id")
  @ZodResponse({ status: 200, type: AdminDepartureResultDto })
  async updateDeparture(
    @Param("id") id: string,
    @Body() body: AdminUpdateDepartureDto,
    @CurrentAuth() a: AuthContext,
    @Req() r: FastifyRequest,
  ) {
    return { departure: await this.catalog.updateDeparture(pid(id, "departure"), body, a, ip(r)) };
  }

  // Customers
  @RequirePermissions("customer:read")
  @Get("customers")
  @ZodResponse({ status: 200, type: AdminCustomerListDto })
  customerList(
    @Query() q: AdminCustomerListQueryDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    noStore(reply);
    return this.customers.list(q);
  }

  @RequirePermissions("customer:read")
  @Get("customers/:id")
  @ZodResponse({ status: 200, type: AdminCustomerDetailDto })
  customer(@Param("id") id: string, @Res({ passthrough: true }) reply: FastifyReply) {
    noStore(reply);
    return this.customers.detail(pid(id, "customer"));
  }

  @RequirePermissions("customer:manage")
  @Patch("customers/:id")
  @ZodResponse({ status: 200, type: AdminCustomerDetailDto })
  customerStatus(
    @Param("id") id: string,
    @Body() body: AdminCustomerStatusDto,
    @CurrentAuth() a: AuthContext,
    @Req() r: FastifyRequest,
  ) {
    return this.customers.setStatus(pid(id, "customer"), body, a, ip(r));
  }

  @RequirePermissions("customer:manage")
  @Post("customers/:id/sign-out")
  @HttpCode(200)
  @ZodResponse({ status: 200, type: AdminCustomerSignOutDto })
  customerSignOut(
    @Param("id") id: string,
    @CurrentAuth() a: AuthContext,
    @Req() r: FastifyRequest,
  ) {
    return this.customers.signOutEverywhere(pid(id, "customer"), a, ip(r));
  }
}
