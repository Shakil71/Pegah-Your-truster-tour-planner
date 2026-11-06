import { Controller, Get, Inject, Query, Res } from "@nestjs/common";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import {
  LegacyRecordsQuerySchema,
  LegacyRecordsSchema,
  LegacyTablesSchema,
} from "@pegah/contracts";
import type { Prisma } from "@pegah/db";
import type { FastifyReply } from "fastify";
import { createZodDto, ZodResponse } from "nestjs-zod";
import { RequirePermissions } from "../auth/decorators";
import { PRISMA, type Db } from "../prisma/prisma.service";

class LegacyTablesDto extends createZodDto(LegacyTablesSchema) {}
class LegacyRecordsQueryDto extends createZodDto(LegacyRecordsQuerySchema) {}
class LegacyRecordsDto extends createZodDto(LegacyRecordsSchema) {}

const decodeCursor = (c?: string) => (c && /^\d{1,20}$/.test(c) ? BigInt(c) : undefined);

/**
 * Read-only view of everything imported from the old website (ADR-0038):
 * old bookings, enquiries, subscribers and every source row. Contains
 * customer details, so it needs its own permission (owner and admin).
 */
@ApiTags("admin")
@ApiCookieAuth("staff")
@Controller("admin/legacy")
export class LegacyAdminController {
  constructor(@Inject(PRISMA) private readonly db: Db) {}

  @RequirePermissions("legacy:read")
  @Get("tables")
  @ZodResponse({ status: 200, type: LegacyTablesDto })
  async tables(@Res({ passthrough: true }) reply: FastifyReply) {
    reply.header("cache-control", "no-store");
    const rows = await this.db.legacyRecord.groupBy({
      by: ["sourceTable"],
      _count: { _all: true, targetId: true },
      orderBy: { sourceTable: "asc" },
    });
    const tables = rows.map((r) => ({
      table: r.sourceTable,
      rows: r._count._all,
      linked: r._count.targetId,
    }));
    return { tables, total: tables.reduce((n, t) => n + t.rows, 0) };
  }

  @RequirePermissions("legacy:read")
  @Get("records")
  @ZodResponse({ status: 200, type: LegacyRecordsDto })
  async records(
    @Query() q: LegacyRecordsQueryDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    reply.header("cache-control", "no-store");
    const where: Prisma.LegacyRecordWhereInput = { sourceTable: q.table };
    const before = decodeCursor(q.cursor);
    if (before !== undefined) where.id = { lt: before };
    if (q.q) {
      // Text search over the whole original row (parameterised; LIKE wildcards escaped).
      const like = `%${q.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      const ids = await this.db.$queryRaw<Array<{ id: bigint }>>`
        SELECT id FROM legacy_records
        WHERE source_table = ${q.table} AND CAST(payload AS CHAR) LIKE ${like}
        ORDER BY id DESC LIMIT 1000`;
      where.id = { ...(before !== undefined ? { lt: before } : {}), in: ids.map((r) => r.id) };
    }
    const rows = await this.db.legacyRecord.findMany({
      where,
      orderBy: { id: "desc" },
      take: q.limit + 1,
    });
    const page = rows.slice(0, q.limit);
    return {
      items: page.map((r) => ({
        id: r.id.toString(),
        sourceId: r.sourceId,
        targetType: r.targetType,
        targetId: r.targetId?.toString() ?? null,
        payload: r.payload as Record<string, string | null>,
        importedAt: r.importedAt.toISOString(),
      })),
      nextCursor: rows.length > q.limit && page.length > 0 ? page.at(-1)!.id.toString() : null,
    };
  }
}
