import { Inject, Injectable } from "@nestjs/common";
import type { ActorType, Prisma } from "@pegah/db";
import { PRISMA, type Db } from "../prisma/prisma.service";

export interface AuditEntry {
  actorType: ActorType;
  actorUserId?: bigint | null;
  action: string;
  targetType?: string;
  targetId?: string;
  ipAddress?: string | null;
  /** Never put passwords, tokens, payment credentials or identity documents here. */
  metadata?: Prisma.InputJsonValue;
}

type AuditWriter = Pick<Db, "auditEvent">;

/** Append-only audit log for sensitive actions. */
@Injectable()
export class AuditService {
  constructor(@Inject(PRISMA) private readonly db: Db) {}

  /** Pass a transaction client to record the event atomically with the change. */
  async record(entry: AuditEntry, tx: AuditWriter = this.db): Promise<void> {
    await tx.auditEvent.create({
      data: {
        actorType: entry.actorType,
        actorUserId: entry.actorUserId ?? null,
        action: entry.action,
        targetType: entry.targetType ?? null,
        targetId: entry.targetId ?? null,
        ipAddress: entry.ipAddress ?? null,
        ...(entry.metadata !== undefined ? { metadata: entry.metadata } : {}),
      },
    });
  }
}
