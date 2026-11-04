import { Body, Controller, Get, Inject, Param, Post, Put, Query, Req, Res } from "@nestjs/common";
import { ApiCookieAuth, ApiProduces, ApiTags } from "@nestjs/swagger";
import {
  ContentPageInputSchema,
  ContentPageListSchema,
  ContentPageSchema,
  CreateContentPageSchema,
  CreatePromotionSchema,
  PromotionInputSchema,
  PromotionListSchema,
  PromotionViewSchema,
  PublicContentPageSchema,
  PublicIdSchema,
  ReportQuerySchema,
  SalesReportSchema,
  SlugSchema,
} from "@pegah/contracts";
import type { FastifyReply, FastifyRequest } from "fastify";
import { createZodDto, ZodResponse } from "nestjs-zod";
import { z } from "zod";
import type { AuthContext } from "../auth/auth.types";
import { CurrentAuth, Public, RequirePermissions } from "../auth/decorators";
import { ProblemException } from "../common/problem";
import { GrowthService } from "./growth.service";

class CreatePromotionDto extends createZodDto(CreatePromotionSchema) {}
class PromotionInputDto extends createZodDto(PromotionInputSchema) {}
class PromotionListDto extends createZodDto(PromotionListSchema) {}
class PromotionResultDto extends createZodDto(z.object({ promotion: PromotionViewSchema })) {}
class ReportQueryDto extends createZodDto(ReportQuerySchema) {}
class SalesReportDto extends createZodDto(SalesReportSchema) {}
class ContentPageInputDto extends createZodDto(ContentPageInputSchema) {}
class CreateContentPageDto extends createZodDto(CreateContentPageSchema) {}
class ContentPageDto extends createZodDto(ContentPageSchema) {}
class ContentPageListDto extends createZodDto(ContentPageListSchema) {}
class PublicContentPageDto extends createZodDto(PublicContentPageSchema) {}

const ip = (r: FastifyRequest) => r.ip ?? null;
const noStore = (reply: FastifyReply) => void reply.header("cache-control", "no-store");
const slugOr404 = (s: string) => {
  const p = SlugSchema.safeParse(s);
  if (!p.success) throw new ProblemException(404, "page-not-found", "Page not found");
  return p.data;
};

@ApiTags("admin-growth")
@ApiCookieAuth("staff")
@Controller("admin")
export class GrowthAdminController {
  constructor(@Inject(GrowthService) private readonly growth: GrowthService) {}

  @RequirePermissions("promotion:manage")
  @Get("promotions")
  @ZodResponse({ status: 200, type: PromotionListDto })
  async promotions(@Res({ passthrough: true }) reply: FastifyReply) {
    noStore(reply);
    return { items: await this.growth.promotions() };
  }

  @RequirePermissions("promotion:manage")
  @Post("promotions")
  @ZodResponse({ status: 201, type: PromotionResultDto })
  async createPromotion(
    @Body() body: CreatePromotionDto,
    @CurrentAuth() a: AuthContext,
    @Req() r: FastifyRequest,
  ) {
    return { promotion: await this.growth.createPromotion(body, a, ip(r)) };
  }

  @RequirePermissions("promotion:manage")
  @Put("promotions/:id")
  @ZodResponse({ status: 200, type: PromotionResultDto })
  async updatePromotion(
    @Param("id") id: string,
    @Body() body: PromotionInputDto,
    @CurrentAuth() a: AuthContext,
    @Req() r: FastifyRequest,
  ) {
    const parsed = PublicIdSchema.safeParse(id);
    if (!parsed.success)
      throw new ProblemException(404, "promotion-not-found", "Promotion not found");
    return { promotion: await this.growth.updatePromotion(parsed.data, body, a, ip(r)) };
  }

  @RequirePermissions("report:read")
  @Get("reports/sales")
  @ZodResponse({ status: 200, type: SalesReportDto })
  sales(@Query() q: ReportQueryDto, @Res({ passthrough: true }) reply: FastifyReply) {
    noStore(reply);
    return this.growth.sales(q);
  }

  /** One row per booking created in the range, for spreadsheets. */
  @RequirePermissions("report:read")
  @Get("reports/bookings.csv")
  @ApiProduces("text/csv")
  async bookingsCsv(@Query() q: ReportQueryDto, @Res() reply: FastifyReply) {
    const csv = await this.growth.bookingsCsv(q);
    void reply
      .header("cache-control", "no-store")
      .header(
        "content-disposition",
        `attachment; filename="pegah-bookings-${q.from}-to-${q.to}.csv"`,
      )
      .type("text/csv; charset=utf-8")
      .send(csv);
  }

  @RequirePermissions("content:manage")
  @Get("pages")
  @ZodResponse({ status: 200, type: ContentPageListDto })
  async pages(@Res({ passthrough: true }) reply: FastifyReply) {
    noStore(reply);
    return { items: await this.growth.pages() };
  }

  @RequirePermissions("content:manage")
  @Get("pages/:slug")
  @ZodResponse({ status: 200, type: ContentPageDto })
  page(@Param("slug") slug: string, @Res({ passthrough: true }) reply: FastifyReply) {
    noStore(reply);
    return this.growth.page(slugOr404(slug));
  }

  @RequirePermissions("content:manage")
  @Post("pages")
  @ZodResponse({ status: 201, type: ContentPageDto })
  createPage(
    @Body() body: CreateContentPageDto,
    @CurrentAuth() a: AuthContext,
    @Req() r: FastifyRequest,
  ) {
    const { slug, ...input } = body;
    return this.growth.savePage(slug, input, true, a, ip(r));
  }

  @RequirePermissions("content:manage")
  @Put("pages/:slug")
  @ZodResponse({ status: 200, type: ContentPageDto })
  updatePage(
    @Param("slug") slug: string,
    @Body() body: ContentPageInputDto,
    @CurrentAuth() a: AuthContext,
    @Req() r: FastifyRequest,
  ) {
    return this.growth.savePage(slugOr404(slug), body, false, a, ip(r));
  }
}

@ApiTags("content")
@Public()
@Controller("pages")
export class PublicPagesController {
  constructor(@Inject(GrowthService) private readonly growth: GrowthService) {}

  @Get(":slug")
  @ZodResponse({ status: 200, type: PublicContentPageDto })
  page(@Param("slug") slug: string, @Res({ passthrough: true }) reply: FastifyReply) {
    void reply.header("cache-control", "public, max-age=300, stale-while-revalidate=300");
    return this.growth.publicPage(slugOr404(slug));
  }
}
