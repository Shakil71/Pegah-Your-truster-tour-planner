import { Inject, Injectable } from "@nestjs/common";
import type { AuditListQuery, AuditListResponse } from "@pegah/contracts";
import type { Prisma } from "@pegah/db";
import { decodeCursor, encodeCursor } from "../booking/booking.mappers";
import { PRISMA, type Db } from "../prisma/prisma.service";

/** Read side of the append-only audit log (newest first, keyset pagination). */
@Injectable()
export class AuditQueryService {
  constructor(@Inject(PRISMA) private readonly db: Db) {}

  async list(q: AuditListQuery): Promise<AuditListResponse> {
    const where: Prisma.AuditEventWhereInput = {};
    if (q.action) where.action = { startsWith: q.action };
    if (q.targetId) where.targetId = q.targetId;
    const before = decodeCursor(q.cursor);
    if (before !== undefined) where.id = { lt: before };

    const rows = await this.db.auditEvent.findMany({
      where,
      orderBy: { id: "desc" },
      take: q.limit + 1,
    });
    const page = rows.slice(0, q.limit);
    const ids = [...new Set(page.map((r) => r.actorUserId).filter((v): v is bigint => v !== null))];
    const users = new Map(
      (
        await this.db.user.findMany({
          where: { id: { in: ids } },
          select: { id: true, fullName: true, email: true },
        })
      ).map((u) => [u.id, u]),
    );
    return {
      items: page.map((r) => {
        const u = r.actorUserId !== null ? users.get(r.actorUserId) : undefined;
        return {
          id: r.id.toString(),
          action: r.action,
          actorType: r.actorType,
          actorName: u?.fullName ?? null,
          actorEmail: u?.email ?? null,
          targetType: r.targetType,
          targetId: r.targetId,
          ipAddress: r.ipAddress,
          metadata: r.metadata ?? null,
          at: r.createdAt.toISOString(),
        };
      }),
      nextCursor:
        rows.length > q.limit && page.length > 0 ? encodeCursor(page[page.length - 1]!.id) : null,
    };
  }
}
