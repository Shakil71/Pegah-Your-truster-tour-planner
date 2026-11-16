import { Body, Controller, Get, Inject, Param, Post, Put, Query, Req, Res } from "@nestjs/common";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import {
  AdminContactListQuerySchema,
  AdminContactListSchema,
  AdminContactMessageSchema,
  AdminContactUpdateSchema,
  ContactMessageCreateSchema,
  ContactMessageReceiptSchema,
  PublicIdSchema,
} from "@pegah/contracts";
import type { FastifyReply, FastifyRequest } from "fastify";
import { createZodDto, ZodResponse } from "nestjs-zod";
import type { AuthContext } from "../auth/auth.types";
import { CurrentAuth, Public, RequirePermissions } from "../auth/decorators";
import { ProblemException } from "../common/problem";
import { ContactService } from "./contact.service";

class ContactMessageCreateDto extends createZodDto(ContactMessageCreateSchema) {}
class ContactMessageReceiptDto extends createZodDto(ContactMessageReceiptSchema) {}
class AdminContactListQueryDto extends createZodDto(AdminContactListQuerySchema) {}
class AdminContactListDto extends createZodDto(AdminContactListSchema) {}
class AdminContactMessageDto extends createZodDto(AdminContactMessageSchema) {}
class AdminContactUpdateDto extends createZodDto(AdminContactUpdateSchema) {}

const ip = (r: FastifyRequest) => r.ip ?? null;

/** The website contact form (ADR-0041): open to everyone, rate-limited per address. */
@ApiTags("contact")
@Public()
@Controller("contact")
export class PublicContactController {
  constructor(@Inject(ContactService) private readonly contact: ContactService) {}

  @Throttle({ default: { limit: 5, ttl: 10 * 60_000 } })
  @Post()
  @ZodResponse({ status: 201, type: ContactMessageReceiptDto })
  create(@Body() body: ContactMessageCreateDto, @Req() r: FastifyRequest) {
    return this.contact.create(body, r.auth, ip(r));
  }
}

@ApiTags("admin")
@ApiCookieAuth("staff")
@Controller("admin/contact-messages")
export class AdminContactController {
  constructor(@Inject(ContactService) private readonly contact: ContactService) {}

  @RequirePermissions("service:manage")
  @Get()
  @ZodResponse({ status: 200, type: AdminContactListDto })
  list(@Query() q: AdminContactListQueryDto, @Res({ passthrough: true }) reply: FastifyReply) {
    void reply.header("cache-control", "no-store");
    return this.contact.adminList(q);
  }

  @RequirePermissions("service:manage")
  @Put(":id")
  @ZodResponse({ status: 200, type: AdminContactMessageDto })
  update(
    @Param("id") id: string,
    @Body() body: AdminContactUpdateDto,
    @CurrentAuth() a: AuthContext,
    @Req() r: FastifyRequest,
  ) {
    const p = PublicIdSchema.safeParse(id);
    if (!p.success) throw new ProblemException(404, "contact-not-found", "Message not found");
    return this.contact.update(p.data, body, a, ip(r));
  }
}
