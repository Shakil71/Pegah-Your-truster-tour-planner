import { Controller, Get, Inject, Param, Query, Res } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import {
  DestinationDetailSchema,
  DestinationListResponseSchema,
  HotelDetailSchema,
  HotelOffersQuerySchema,
  HotelOffersResponseSchema,
  HotelSearchQuerySchema,
  HotelSearchResponseSchema,
  SlugSchema,
  TourDetailSchema,
  TourListResponseSchema,
} from "@pegah/contracts";
import type { FastifyReply } from "fastify";
import { createZodDto, ZodResponse } from "nestjs-zod";
import { Public } from "../auth/decorators";
import { ProblemException } from "../common/problem";
import { CatalogService } from "./catalog.service";

class DestinationListResponseDto extends createZodDto(DestinationListResponseSchema) {}
class DestinationDetailDto extends createZodDto(DestinationDetailSchema) {}
class HotelDetailDto extends createZodDto(HotelDetailSchema) {}
class HotelOffersQueryDto extends createZodDto(HotelOffersQuerySchema) {}
class HotelOffersResponseDto extends createZodDto(HotelOffersResponseSchema) {}
class HotelSearchQueryDto extends createZodDto(HotelSearchQuerySchema) {}
class HotelSearchResponseDto extends createZodDto(HotelSearchResponseSchema) {}
class TourListResponseDto extends createZodDto(TourListResponseSchema) {}
class TourDetailDto extends createZodDto(TourDetailSchema) {}

function slugOr404(slug: string, what: string): string {
  const parsed = SlugSchema.safeParse(slug);
  if (!parsed.success) throw new ProblemException(404, `${what}-not-found`, "Not found");
  return parsed.data;
}

/**
 * Browser/CDN caching for public catalog reads. Search results are short-lived
 * because availability changes; nothing here is used to confirm a booking.
 */
function cacheFor(reply: FastifyReply, seconds: number) {
  void reply.header(
    "cache-control",
    `public, max-age=${seconds}, stale-while-revalidate=${seconds}`,
  );
}

@ApiTags("catalog")
@Public()
@Controller()
export class CatalogController {
  constructor(@Inject(CatalogService) private readonly catalog: CatalogService) {}

  @Get("destinations")
  @ZodResponse({ status: 200, type: DestinationListResponseDto })
  async destinations(@Res({ passthrough: true }) reply: FastifyReply) {
    cacheFor(reply, 300);
    return { items: await this.catalog.listDestinations() };
  }

  @Get("destinations/:slug")
  @ZodResponse({ status: 200, type: DestinationDetailDto })
  destination(@Param("slug") slug: string, @Res({ passthrough: true }) reply: FastifyReply) {
    cacheFor(reply, 300);
    return this.catalog.destination(slugOr404(slug, "destination"));
  }

  @Get("hotels/search")
  @ZodResponse({ status: 200, type: HotelSearchResponseDto })
  search(@Query() query: HotelSearchQueryDto, @Res({ passthrough: true }) reply: FastifyReply) {
    cacheFor(reply, 30);
    return this.catalog.searchHotels(query);
  }

  @Get("hotels/:slug")
  @ZodResponse({ status: 200, type: HotelDetailDto })
  hotel(@Param("slug") slug: string, @Res({ passthrough: true }) reply: FastifyReply) {
    cacheFor(reply, 300);
    return this.catalog.hotel(slugOr404(slug, "hotel"));
  }

  @Get("hotels/:slug/offers")
  @ZodResponse({ status: 200, type: HotelOffersResponseDto })
  offers(
    @Param("slug") slug: string,
    @Query() query: HotelOffersQueryDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    cacheFor(reply, 30);
    return this.catalog.hotelOffers(slugOr404(slug, "hotel"), query);
  }

  @Get("tours")
  @ZodResponse({ status: 200, type: TourListResponseDto })
  async tours(@Res({ passthrough: true }) reply: FastifyReply) {
    cacheFor(reply, 120);
    return { items: await this.catalog.listTours() };
  }

  @Get("tours/:slug")
  @ZodResponse({ status: 200, type: TourDetailDto })
  tour(@Param("slug") slug: string, @Res({ passthrough: true }) reply: FastifyReply) {
    cacheFor(reply, 120);
    return this.catalog.tour(slugOr404(slug, "tour"));
  }
}
