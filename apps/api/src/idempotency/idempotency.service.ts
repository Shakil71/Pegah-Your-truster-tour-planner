import { Inject, Injectable } from "@nestjs/common";
import { IdempotencyKeySchema } from "@pegah/contracts";
import { Prisma } from "@pegah/db";
import { createHash } from "node:crypto";
import { ProblemException } from "../common/problem";
import { PRISMA, type Db } from "../prisma/prisma.service";

const KEY_TTL_MS = 24 * 60 * 60_000;
/** A request that crashed mid-way releases its key after this long. */
const LOCK_MS = 60_000;

/** Stable JSON: object keys sorted, so the hash ignores key order. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function requestHash(body: unknown): string {
  return createHash("sha256").update(canonical(body)).digest("hex");
}

export function parseIdempotencyKey(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = IdempotencyKeySchema.safeParse(value);
  if (!parsed.success) {
    throw new ProblemException(
      400,
      "idempotency-key-required",
      "Idempotency-Key header required",
      "Send a unique Idempotency-Key header (16–128 characters) with this request.",
    );
  }
  return parsed.data;
}

export interface IdempotentResult<T> {
  status: number;
  body: T;
  replayed: boolean;
}

/**
 * Exactly-once execution for retried mutations (booking creation, later
 * payments). The first request with a key runs; a retry with the same key and
 * body gets the stored response; the same key with a different body is
 * rejected. Failed attempts free the key so the client can retry it.
 */
@Injectable()
export class IdempotencyService {
  constructor(@Inject(PRISMA) private readonly db: Db) {}

  async execute<T>(
    scope: { actorKey: string; key: string; route: string; body: unknown },
    run: () => Promise<{ status: number; body: T }>,
    now: Date = new Date(),
  ): Promise<IdempotentResult<T>> {
    const hash = requestHash(scope.body);
    const id = await this.claim(scope, hash, now);
    if (typeof id !== "bigint") return id as IdempotentResult<T>;

    let result: { status: number; body: T };
    try {
      result = await run();
    } catch (error) {
      await this.db.idempotencyKey.delete({ where: { id } }).catch(() => undefined);
      throw error;
    }
    await this.db.idempotencyKey.update({
      where: { id },
      data: {
        responseStatus: result.status,
        responseBody: result.body as Prisma.InputJsonValue,
        lockedUntil: null,
      },
    });
    return { ...result, replayed: false };
  }

  /** Returns the new row id to run with, or a stored result to replay. */
  private async claim(
    scope: { actorKey: string; key: string; route: string },
    hash: string,
    now: Date,
  ): Promise<bigint | IdempotentResult<unknown>> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const row = await this.db.idempotencyKey.create({
          data: {
            actorKey: scope.actorKey,
            key: scope.key,
            route: scope.route,
            requestHash: hash,
            lockedUntil: new Date(now.getTime() + LOCK_MS),
            expiresAt: new Date(now.getTime() + KEY_TTL_MS),
          },
          select: { id: true },
        });
        return row.id;
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) {
          throw error;
        }
      }

      const existing = await this.db.idempotencyKey.findUnique({
        where: {
          actorKey_key_route: { actorKey: scope.actorKey, key: scope.key, route: scope.route },
        },
      });
      if (!existing) continue; // deleted by a failed attempt meanwhile: try again
      if (existing.expiresAt <= now) {
        await this.db.idempotencyKey.deleteMany({ where: { id: existing.id } });
        continue;
      }
      if (existing.requestHash !== hash) {
        throw new ProblemException(
          422,
          "idempotency-key-reused",
          "Idempotency key reused",
          "This Idempotency-Key was already used for a different request.",
        );
      }
      if (existing.responseStatus !== null) {
        return { status: existing.responseStatus, body: existing.responseBody, replayed: true };
      }
      if (existing.lockedUntil && existing.lockedUntil > now) {
        throw new ProblemException(
          409,
          "idempotency-in-progress",
          "Request in progress",
          "The same request is still being processed. Try again in a moment.",
        );
      }
      // Stale lock from a crashed request: take it over atomically.
      const taken = await this.db.idempotencyKey.updateMany({
        where: { id: existing.id, responseStatus: null, lockedUntil: existing.lockedUntil },
        data: { lockedUntil: new Date(now.getTime() + LOCK_MS) },
      });
      if (taken.count === 1) return existing.id;
      throw new ProblemException(409, "idempotency-in-progress", "Request in progress");
    }
    throw new ProblemException(409, "idempotency-in-progress", "Request in progress");
  }
}
