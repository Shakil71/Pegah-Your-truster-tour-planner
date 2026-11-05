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
import { ApiBody, ApiConsumes, ApiCookieAuth, ApiExcludeEndpoint, ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import {
  MediaKeySchema,
  MediaListQuerySchema,
  MediaListSchema,
  MediaResultSchema,
  MediaUpdateSchema,
  MediaUploadQuerySchema,
} from "@pegah/contracts";
import type { FastifyReply, FastifyRequest } from "fastify";
import { createZodDto, ZodResponse } from "nestjs-zod";
import type { AuthContext } from "../auth/auth.types";
import { CurrentAuth, Public, RequirePermissions } from "../auth/decorators";
import { ProblemException } from "../common/problem";
import { MediaService } from "./media.service";

class AdminMediaListQueryDto extends createZodDto(MediaListQuerySchema) {}
class AdminMediaListDto extends createZodDto(MediaListSchema) {}
class AdminMediaUploadQueryDto extends createZodDto(MediaUploadQuerySchema) {}
class AdminMediaUpdateDto extends createZodDto(MediaUpdateSchema) {}
class AdminMediaResultDto extends createZodDto(MediaResultSchema) {}

const ip = (r: FastifyRequest) => r.ip ?? null;
const keyOf = (key: string) => {
  const parsed = MediaKeySchema.safeParse(key);
  if (!parsed.success) throw new ProblemException(404, "media-not-found", "Image not found");
  return parsed.data;
};

/** Media library in the console (ADR-0030). */
@ApiTags("admin-media")
@ApiCookieAuth("staff")
@Controller("admin/media")
export class AdminMediaController {
  constructor(@Inject(MediaService) private readonly media: MediaService) {}

  @RequirePermissions("catalog:read")
  @Get()
  @ZodResponse({ status: 200, type: AdminMediaListDto })
  list(@Query() q: AdminMediaListQueryDto, @Res({ passthrough: true }) reply: FastifyReply) {
    void reply.header("cache-control", "no-store");
    return this.media.list(q);
  }

  /** Upload one image as the raw request body (JPEG, PNG or WebP, at most 1 MB). */
  @RequirePermissions("catalog:manage")
  @Post()
  @HttpCode(201)
  @ApiConsumes("image/jpeg", "image/png", "image/webp")
  @ApiBody({ schema: { type: "string", format: "binary" } })
  @ZodResponse({ status: 201, type: AdminMediaResultDto })
  async upload(
    @Req() r: FastifyRequest,
    @Query() q: AdminMediaUploadQueryDto,
    @CurrentAuth() a: AuthContext,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const { created, media } = await this.media.upload(r.body, q, a, ip(r));
    if (!created) void reply.status(200);
    return { media };
  }

  @RequirePermissions("catalog:manage")
  @Put(":key")
  @ZodResponse({ status: 200, type: AdminMediaResultDto })
  update(
    @Param("key") key: string,
    @Body() body: AdminMediaUpdateDto,
    @CurrentAuth() a: AuthContext,
    @Req() r: FastifyRequest,
  ) {
    return this.media.update(keyOf(key), body, a, ip(r));
  }

  @RequirePermissions("catalog:manage")
  @Delete(":key")
  @HttpCode(204)
  async remove(@Param("key") key: string, @CurrentAuth() a: AuthContext, @Req() r: FastifyRequest) {
    await this.media.remove(keyOf(key), a, ip(r));
  }
}

/** Public image delivery: immutable, because the key is the content hash. */
@ApiTags("media")
@Public()
@SkipThrottle()
@Controller("media")
export class PublicMediaController {
  constructor(@Inject(MediaService) private readonly media: MediaService) {}

  @ApiExcludeEndpoint()
  @Get(":key")
  async file(@Param("key") key: string, @Res() reply: FastifyReply) {
    const file = await this.media.file(keyOf(key));
    if (!file) throw new ProblemException(404, "media-not-found", "Image not found");
    void reply
      .header("content-type", file.mime)
      .header("cache-control", "public, max-age=31536000, immutable")
      .header("etag", `"${key}"`)
      .send(file.bytes);
  }
}
