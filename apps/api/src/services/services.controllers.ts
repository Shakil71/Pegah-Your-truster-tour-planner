import {
  Body,
  Controller,
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
import { ApiBody, ApiConsumes, ApiCookieAuth, ApiProduces, ApiTags } from "@nestjs/swagger";
import { SkipThrottle, Throttle } from "@nestjs/throttler";
import {
  AdminServiceListQuerySchema,
  AdminServiceListSchema,
  AdminServiceRequestSchema,
  AdminVisaProductListSchema,
  CreateFlightRequestSchema,
  CreateVisaProductSchema,
  CreateVisaRequestSchema,
  DocumentUploadQuerySchema,
  PublicIdSchema,
  ServiceActionSchema,
  ServiceCancelSchema,
  ServiceReplySchema,
  ServiceRequestDetailSchema,
  ServiceRequestListSchema,
  SlugSchema,
  VisaProductDetailSchema,
  VisaProductInputSchema,
  VisaProductListSchema,
} from "@pegah/contracts";
import type { FastifyReply, FastifyRequest } from "fastify";
import { createZodDto, ZodResponse } from "nestjs-zod";
import { z } from "zod";
import type { AuthContext } from "../auth/auth.types";
import { CurrentAuth, Public, RequirePermissions } from "../auth/decorators";
import { ProblemException } from "../common/problem";
import { ServiceRequestService } from "./service-request.service";
import { VisaProductsService } from "./visa-products.service";

class VisaProductListDto extends createZodDto(VisaProductListSchema) {}
class VisaProductDetailDto extends createZodDto(VisaProductDetailSchema) {}
class CreateVisaRequestDto extends createZodDto(CreateVisaRequestSchema) {}
class CreateFlightRequestDto extends createZodDto(CreateFlightRequestSchema) {}
class ServiceRequestDetailDto extends createZodDto(ServiceRequestDetailSchema) {}
class ServiceRequestListDto extends createZodDto(ServiceRequestListSchema) {}
class ServiceReplyDto extends createZodDto(ServiceReplySchema) {}
class ServiceCancelDto extends createZodDto(ServiceCancelSchema) {}
class DocumentUploadQueryDto extends createZodDto(DocumentUploadQuerySchema) {}
class ServiceListQueryDto extends createZodDto(
  z.object({ cursor: z.string().max(40).optional() }),
) {}
class AdminServiceListQueryDto extends createZodDto(AdminServiceListQuerySchema) {}
class AdminServiceListDto extends createZodDto(AdminServiceListSchema) {}
class AdminServiceRequestDto extends createZodDto(AdminServiceRequestSchema) {}
class ServiceActionDto extends createZodDto(ServiceActionSchema) {}
class AdminVisaProductListDto extends createZodDto(AdminVisaProductListSchema) {}
class CreateVisaProductDto extends createZodDto(CreateVisaProductSchema) {}
class VisaProductInputDto extends createZodDto(VisaProductInputSchema) {}

const pid = (v: string, what: string) => {
  const p = PublicIdSchema.safeParse(v);
  if (!p.success) throw new ProblemException(404, `${what}-not-found`, "Not found");
  return p.data;
};
const slug = (v: string) => {
  const p = SlugSchema.safeParse(v);
  if (!p.success) throw new ProblemException(404, "visa-not-found", "Visa not found");
  return p.data;
};
const ip = (r: FastifyRequest) => r.ip ?? null;
const noStore = (reply: FastifyReply) => void reply.header("cache-control", "no-store");

/** Sends a decrypted document: never cached, never sniffed, always a download. */
function sendDocument(
  reply: FastifyReply,
  file: { bytes: Buffer; mime: string; fileName: string },
) {
  const ascii = file.fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  void reply
    .header("content-type", file.mime)
    .header(
      "content-disposition",
      `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
    )
    .header("cache-control", "no-store, private")
    .header("x-content-type-options", "nosniff")
    .send(file.bytes);
}

@ApiTags("visas")
@Public()
@Controller("visas")
export class PublicVisasController {
  constructor(@Inject(VisaProductsService) private readonly visas: VisaProductsService) {}

  @Get()
  @ZodResponse({ status: 200, type: VisaProductListDto })
  list(@Res({ passthrough: true }) reply: FastifyReply) {
    void reply.header("cache-control", "public, max-age=60");
    return this.visas.list();
  }

  @Get(":slug")
  @ZodResponse({ status: 200, type: VisaProductDetailDto })
  one(@Param("slug") s: string, @Res({ passthrough: true }) reply: FastifyReply) {
    void reply.header("cache-control", "public, max-age=60");
    return this.visas.detail(slug(s));
  }
}

@ApiTags("requests")
@ApiCookieAuth("customer")
@Controller("me/requests")
export class MyRequestsController {
  constructor(@Inject(ServiceRequestService) private readonly requests: ServiceRequestService) {}

  @Get()
  @ZodResponse({ status: 200, type: ServiceRequestListDto })
  list(
    @CurrentAuth() a: AuthContext,
    @Query() q: ServiceListQueryDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    noStore(reply);
    return this.requests.listMine(a, q.cursor);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("visa")
  @ZodResponse({ status: 201, type: ServiceRequestDetailDto })
  visa(@CurrentAuth() a: AuthContext, @Body() body: CreateVisaRequestDto) {
    return this.requests.createVisa(body, a);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("flight")
  @ZodResponse({ status: 201, type: ServiceRequestDetailDto })
  flight(@CurrentAuth() a: AuthContext, @Body() body: CreateFlightRequestDto) {
    return this.requests.createFlight(body, a);
  }

  @Get(":id")
  @ZodResponse({ status: 200, type: ServiceRequestDetailDto })
  one(
    @CurrentAuth() a: AuthContext,
    @Param("id") id: string,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    noStore(reply);
    return this.requests.mine(pid(id, "request"), a);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post(":id/reply")
  @HttpCode(200)
  @ZodResponse({ status: 200, type: ServiceRequestDetailDto })
  reply(@CurrentAuth() a: AuthContext, @Param("id") id: string, @Body() body: ServiceReplyDto) {
    return this.requests.reply(pid(id, "request"), body.message, a);
  }

  @Post(":id/cancel")
  @HttpCode(200)
  @ZodResponse({ status: 200, type: ServiceRequestDetailDto })
  cancel(@CurrentAuth() a: AuthContext, @Param("id") id: string, @Body() body: ServiceCancelDto) {
    return this.requests.cancelMine(pid(id, "request"), body.reason ?? null, a);
  }

  /** One document as the raw request body (PDF, JPG or PNG, at most 5 MB). */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post(":id/documents")
  @HttpCode(201)
  @ApiConsumes("application/octet-stream")
  @ApiBody({ schema: { type: "string", format: "binary" } })
  @ZodResponse({ status: 201, type: ServiceRequestDetailDto })
  async upload(
    @CurrentAuth() a: AuthContext,
    @Param("id") id: string,
    @Query() q: DocumentUploadQueryDto,
    @Req() r: FastifyRequest,
  ) {
    const requestId = pid(id, "request");
    await this.requests.upload(requestId, r.body, q, {
      auth: a,
      staff: false,
      ip: ip(r),
    });
    return this.requests.mine(requestId, a);
  }

  @SkipThrottle()
  @Get(":id/documents/:doc")
  @ApiProduces("application/pdf", "image/jpeg", "image/png")
  async download(
    @CurrentAuth() a: AuthContext,
    @Param("id") id: string,
    @Param("doc") doc: string,
    @Req() r: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    sendDocument(
      reply,
      await this.requests.download(pid(id, "request"), pid(doc, "document"), {
        auth: a,
        staff: false,
        ip: ip(r),
      }),
    );
  }
}

@ApiTags("admin")
@ApiCookieAuth("staff")
@Controller("admin")
export class AdminRequestsController {
  constructor(
    @Inject(ServiceRequestService) private readonly requests: ServiceRequestService,
    @Inject(VisaProductsService) private readonly visas: VisaProductsService,
  ) {}

  @RequirePermissions("service:manage")
  @Get("requests")
  @ZodResponse({ status: 200, type: AdminServiceListDto })
  list(@Query() q: AdminServiceListQueryDto, @Res({ passthrough: true }) reply: FastifyReply) {
    noStore(reply);
    return this.requests.adminList(q);
  }

  @RequirePermissions("service:manage")
  @Get("requests/:id")
  @ZodResponse({ status: 200, type: AdminServiceRequestDto })
  one(@Param("id") id: string, @Res({ passthrough: true }) reply: FastifyReply) {
    noStore(reply);
    return this.requests.adminDetail(pid(id, "request"));
  }

  @RequirePermissions("service:manage")
  @Post("requests/:id/actions")
  @HttpCode(200)
  @ZodResponse({ status: 200, type: AdminServiceRequestDto })
  act(
    @Param("id") id: string,
    @Body() body: ServiceActionDto,
    @CurrentAuth() a: AuthContext,
    @Req() r: FastifyRequest,
  ) {
    return this.requests.act(pid(id, "request"), body, a, ip(r));
  }

  @RequirePermissions("service:manage")
  @Post("requests/:id/documents")
  @HttpCode(201)
  @ApiConsumes("application/octet-stream")
  @ApiBody({ schema: { type: "string", format: "binary" } })
  @ZodResponse({ status: 201, type: AdminServiceRequestDto })
  async upload(
    @Param("id") id: string,
    @Query() q: DocumentUploadQueryDto,
    @CurrentAuth() a: AuthContext,
    @Req() r: FastifyRequest,
  ) {
    const requestId = pid(id, "request");
    await this.requests.upload(requestId, r.body, q, { auth: a, staff: true, ip: ip(r) });
    return this.requests.adminDetail(requestId);
  }

  @RequirePermissions("service:manage")
  @Get("requests/:id/documents/:doc")
  @ApiProduces("application/pdf", "image/jpeg", "image/png")
  async download(
    @Param("id") id: string,
    @Param("doc") doc: string,
    @CurrentAuth() a: AuthContext,
    @Req() r: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    sendDocument(
      reply,
      await this.requests.download(pid(id, "request"), pid(doc, "document"), {
        auth: a,
        staff: true,
        ip: ip(r),
      }),
    );
  }

  @RequirePermissions("catalog:read")
  @Get("visa-products")
  @ZodResponse({ status: 200, type: AdminVisaProductListDto })
  visaProducts(@Res({ passthrough: true }) reply: FastifyReply) {
    noStore(reply);
    return this.visas.adminList();
  }

  @RequirePermissions("catalog:manage")
  @Post("visa-products")
  @ZodResponse({ status: 201, type: AdminVisaProductListDto })
  createVisa(
    @Body() body: CreateVisaProductDto,
    @CurrentAuth() a: AuthContext,
    @Req() r: FastifyRequest,
  ) {
    return this.visas.create(body, a, ip(r));
  }

  @RequirePermissions("catalog:manage")
  @Put("visa-products/:slug")
  @ZodResponse({ status: 200, type: AdminVisaProductListDto })
  updateVisa(
    @Param("slug") s: string,
    @Body() body: VisaProductInputDto,
    @CurrentAuth() a: AuthContext,
    @Req() r: FastifyRequest,
  ) {
    return this.visas.update(slug(s), body, a, ip(r));
  }
}
