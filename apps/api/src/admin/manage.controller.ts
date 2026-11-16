import { Body, Controller, Delete, HttpCode, Inject, Param, Put, Req } from "@nestjs/common";
import { ApiCookieAuth, ApiParam, ApiTags } from "@nestjs/swagger";
import {
  ManagedKindSchema,
  SetVisibilitySchema,
  VisibilityResultSchema,
  type ManagedKind,
} from "@pegah/contracts";
import type { FastifyRequest } from "fastify";
import { createZodDto, ZodResponse } from "nestjs-zod";
import type { AuthContext } from "../auth/auth.types";
import { CurrentAuth, Staff } from "../auth/decorators";
import { ProblemException } from "../common/problem";
import { ManageService } from "./manage.service";

class SetVisibilityDto extends createZodDto(SetVisibilitySchema) {}
class VisibilityResultDto extends createZodDto(VisibilityResultSchema) {}

const kindOf = (k: string): ManagedKind => {
  const p = ManagedKindSchema.safeParse(k);
  if (!p.success) throw new ProblemException(404, "item-not-found", "Not found");
  return p.data;
};
const keyOf = (k: string): string => {
  if (!/^[A-Za-z0-9-]{1,200}$/.test(k)) {
    throw new ProblemException(404, "item-not-found", "Not found");
  }
  return k;
};

/**
 * Delete or show/hide any listing. Staff session required here; the
 * permission for each kind (catalog:manage, promotion:manage, …) is checked
 * by ManageService.
 */
@ApiTags("admin-manage")
@ApiCookieAuth("staff")
@Staff()
@Controller("admin/manage")
export class ManageController {
  constructor(@Inject(ManageService) private readonly manage: ManageService) {}

  @Delete(":kind/:key")
  @HttpCode(204)
  @ApiParam({ name: "kind", enum: ManagedKindSchema.options })
  async remove(
    @Param("kind") kind: string,
    @Param("key") key: string,
    @CurrentAuth() a: AuthContext,
    @Req() r: FastifyRequest,
  ): Promise<void> {
    await this.manage.remove(kindOf(kind), keyOf(key), a, r.ip ?? null);
  }

  @Put(":kind/:key/visibility")
  @ApiParam({ name: "kind", enum: ManagedKindSchema.options })
  @ZodResponse({ status: 200, type: VisibilityResultDto })
  visibility(
    @Param("kind") kind: string,
    @Param("key") key: string,
    @Body() body: SetVisibilityDto,
    @CurrentAuth() a: AuthContext,
    @Req() r: FastifyRequest,
  ) {
    return this.manage.setVisible(kindOf(kind), keyOf(key), body.visible, a, r.ip ?? null);
  }
}
