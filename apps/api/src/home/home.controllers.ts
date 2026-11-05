import { Body, Controller, Get, Inject, Put, Req, Res } from "@nestjs/common";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { HomeSettingsSchema, PublicHomeSchema } from "@pegah/contracts";
import type { FastifyReply, FastifyRequest } from "fastify";
import { createZodDto, ZodResponse } from "nestjs-zod";
import type { AuthContext } from "../auth/auth.types";
import { CurrentAuth, Public, RequirePermissions } from "../auth/decorators";
import { HomeService } from "./home.service";

class AdminHomeSettingsDto extends createZodDto(HomeSettingsSchema) {}
class PublicHomeDto extends createZodDto(PublicHomeSchema) {}

/** Home page editor in the console (ADR-0031). */
@ApiTags("admin-content")
@ApiCookieAuth("staff")
@Controller("admin/home")
export class AdminHomeController {
  constructor(@Inject(HomeService) private readonly home: HomeService) {}

  @RequirePermissions("content:manage")
  @Get()
  @ZodResponse({ status: 200, type: AdminHomeSettingsDto })
  get(@Res({ passthrough: true }) reply: FastifyReply) {
    void reply.header("cache-control", "no-store");
    return this.home.settings();
  }

  @RequirePermissions("content:manage")
  @Put()
  @ZodResponse({ status: 200, type: AdminHomeSettingsDto })
  save(
    @Body() body: AdminHomeSettingsDto,
    @CurrentAuth() a: AuthContext,
    @Req() r: FastifyRequest,
  ) {
    return this.home.save(body, a, r.ip ?? null);
  }
}

/** Home page content for the website. */
@ApiTags("site")
@Public()
@Controller("home")
export class PublicHomeController {
  constructor(@Inject(HomeService) private readonly home: HomeService) {}

  @Get()
  @ZodResponse({ status: 200, type: PublicHomeDto })
  get(@Res({ passthrough: true }) reply: FastifyReply) {
    void reply.header("cache-control", "public, max-age=60, stale-while-revalidate=120");
    return this.home.publicHome();
  }
}
