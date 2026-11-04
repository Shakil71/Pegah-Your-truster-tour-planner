import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req, Res } from "@nestjs/common";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import {
  AuditListQuerySchema,
  AuditListResponseSchema,
  CreateStaffRequestSchema,
  DashboardSummarySchema,
  PublicIdSchema,
  StaffListResponseSchema,
  StaffMemberSchema,
  UpdateStaffRequestSchema,
} from "@pegah/contracts";
import type { FastifyReply, FastifyRequest } from "fastify";
import { createZodDto, ZodResponse } from "nestjs-zod";
import type { AuthContext } from "../auth/auth.types";
import { CurrentAuth, RequirePermissions } from "../auth/decorators";
import { ProblemException } from "../common/problem";
import { AuditQueryService } from "./audit-query.service";
import { DashboardService } from "./dashboard.service";
import { StaffService } from "./staff.service";

class DashboardSummaryDto extends createZodDto(DashboardSummarySchema) {}
class StaffListResponseDto extends createZodDto(StaffListResponseSchema) {}
class StaffMemberDto extends createZodDto(StaffMemberSchema) {}
class CreateStaffRequestDto extends createZodDto(CreateStaffRequestSchema) {}
class UpdateStaffRequestDto extends createZodDto(UpdateStaffRequestSchema) {}
class AuditListQueryDto extends createZodDto(AuditListQuerySchema) {}
class AuditListResponseDto extends createZodDto(AuditListResponseSchema) {}

const noStore = (reply: FastifyReply) => void reply.header("cache-control", "no-store");

@ApiTags("admin")
@ApiCookieAuth("staff")
@Controller("admin")
export class AdminController {
  constructor(
    @Inject(DashboardService) private readonly dashboard: DashboardService,
    @Inject(StaffService) private readonly staff: StaffService,
    @Inject(AuditQueryService) private readonly auditLog: AuditQueryService,
  ) {}

  @RequirePermissions("dashboard:read")
  @Get("dashboard")
  @ZodResponse({ status: 200, type: DashboardSummaryDto })
  summary(@Res({ passthrough: true }) reply: FastifyReply) {
    noStore(reply);
    return this.dashboard.summary();
  }

  @RequirePermissions("user:manage")
  @Get("staff")
  @ZodResponse({ status: 200, type: StaffListResponseDto })
  listStaff(@Res({ passthrough: true }) reply: FastifyReply) {
    noStore(reply);
    return this.staff.list();
  }

  /** Creates a staff account (audited). Only owners can grant the owner role. */
  @RequirePermissions("user:manage")
  @Post("staff")
  @ZodResponse({ status: 201, type: StaffMemberDto })
  createStaff(
    @Body() body: CreateStaffRequestDto,
    @CurrentAuth() auth: AuthContext,
    @Req() request: FastifyRequest,
  ) {
    return this.staff.create(body, auth, request.ip ?? null);
  }

  @RequirePermissions("user:manage")
  @Patch("staff/:id")
  @ZodResponse({ status: 200, type: StaffMemberDto })
  updateStaff(
    @Param("id") id: string,
    @Body() body: UpdateStaffRequestDto,
    @CurrentAuth() auth: AuthContext,
    @Req() request: FastifyRequest,
  ) {
    const parsed = PublicIdSchema.safeParse(id);
    if (!parsed.success)
      throw new ProblemException(404, "staff-not-found", "Staff member not found");
    return this.staff.update(parsed.data, body, auth, request.ip ?? null);
  }

  @RequirePermissions("audit:read")
  @Get("audit")
  @ZodResponse({ status: 200, type: AuditListResponseDto })
  audit(@Query() query: AuditListQueryDto, @Res({ passthrough: true }) reply: FastifyReply) {
    noStore(reply);
    return this.auditLog.list(query);
  }
}
