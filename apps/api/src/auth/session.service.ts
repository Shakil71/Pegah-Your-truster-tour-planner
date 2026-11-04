import { Inject, Injectable } from "@nestjs/common";
import type { Permission, SessionKind } from "@pegah/contracts";
import { PERMISSION_KEYS } from "@pegah/contracts";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { APP_CONFIG, type AppConfig } from "../config/config";
import { PRISMA, type Db } from "../prisma/prisma.service";
import type { AuthContext } from "./auth.types";

const SLIDING_UPDATE_MS = 60_000;
const KNOWN_PERMISSIONS = new Set<string>(PERMISSION_KEYS);

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export interface SessionMeta {
  ipAddress: string | null;
  userAgent: string | null;
}

type SessionWriter = Pick<Db, "session">;

/**
 * Server-side sessions. The cookie holds 256 random bits; the database holds
 * only their SHA-256, so neither a DB leak nor log access yields a session.
 */
@Injectable()
export class SessionService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  cookieName(kind: SessionKind): string {
    const base = kind === "STAFF" ? "pg_staff_sid" : "pg_sid";
    // __Host- cookies must be Secure, Path=/ and host-only: browsers enforce it.
    return this.config.COOKIE_SECURE ? `__Host-${base}` : base;
  }

  ttlMinutes(kind: SessionKind): { absolute: number; idle: number } {
    return kind === "STAFF"
      ? { absolute: this.config.STAFF_SESSION_TTL_MIN, idle: this.config.STAFF_SESSION_IDLE_MIN }
      : {
          absolute: this.config.CUSTOMER_SESSION_TTL_MIN,
          idle: this.config.CUSTOMER_SESSION_IDLE_MIN,
        };
  }

  async create(
    userId: bigint,
    kind: SessionKind,
    meta: SessionMeta,
    tx: SessionWriter = this.db,
    now: Date = new Date(),
  ): Promise<{ token: string; tokenHash: string; sessionId: bigint; maxAgeSeconds: number }> {
    const token = randomBytes(32).toString("base64url");
    const tokenHash = sha256Hex(token);
    const { absolute } = this.ttlMinutes(kind);
    const session = await tx.session.create({
      data: {
        tokenHash,
        userId,
        kind,
        ipAddress: meta.ipAddress?.slice(0, 45) ?? null,
        userAgent: meta.userAgent?.slice(0, 255) ?? null,
        lastSeenAt: now,
        expiresAt: new Date(now.getTime() + absolute * 60_000),
      },
      select: { id: true },
    });
    return { token, tokenHash, sessionId: session.id, maxAgeSeconds: absolute * 60 };
  }

  /** Returns the session for a cookie token, or null if it is invalid, idle or expired. */
  async resolve(
    token: string | undefined,
    kind: SessionKind,
    now: Date = new Date(),
  ): Promise<AuthContext | null> {
    if (!token || token.length > 128) return null;
    const tokenHash = sha256Hex(token);
    const session = await this.db.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!session || session.kind !== kind || session.revokedAt) return null;
    if (session.expiresAt.getTime() <= now.getTime()) return null;
    const { idle } = this.ttlMinutes(kind);
    if (session.lastSeenAt.getTime() + idle * 60_000 <= now.getTime()) return null;
    const user = session.user;
    if (user.status !== "ACTIVE") return null;
    if (kind === "STAFF" && user.kind !== "STAFF") return null;

    const { roles, permissions } =
      kind === "STAFF" ? await this.loadAccess(user.id) : { roles: [], permissions: [] };

    if (now.getTime() - session.lastSeenAt.getTime() > SLIDING_UPDATE_MS) {
      await this.db.session.update({ where: { id: session.id }, data: { lastSeenAt: now } });
    }

    return {
      sessionId: session.id,
      tokenHash,
      kind,
      user: {
        id: user.id,
        publicId: user.publicId,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
      },
      roles,
      permissions,
    };
  }

  async loadAccess(userId: bigint): Promise<{ roles: string[]; permissions: Permission[] }> {
    const grants = await this.db.userRole.findMany({
      where: { userId },
      select: {
        role: {
          select: { key: true, permissions: { select: { permission: { select: { key: true } } } } },
        },
      },
    });
    const roles = grants.map((g) => g.role.key).sort();
    const permissions = new Set<Permission>();
    for (const g of grants) {
      for (const rp of g.role.permissions) {
        // Ignore stale keys left in the DB after a permission is retired.
        if (KNOWN_PERMISSIONS.has(rp.permission.key))
          permissions.add(rp.permission.key as Permission);
      }
    }
    return { roles, permissions: [...permissions].sort() };
  }

  async revoke(sessionId: bigint, now: Date = new Date()): Promise<void> {
    await this.db.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: now },
    });
  }

  /**
   * CSRF token bound to the session: HMAC(secret, session token hash). It can
   * be re-derived on any request and is useless without the HttpOnly cookie.
   */
  csrfToken(tokenHash: string): string {
    return createHmac("sha256", this.config.SESSION_SECRET)
      .update(`csrf:${tokenHash}`)
      .digest("base64url");
  }

  verifyCsrf(tokenHash: string, provided: string | undefined): boolean {
    if (!provided || provided.length > 128) return false;
    const expected = Buffer.from(this.csrfToken(tokenHash));
    const actual = Buffer.from(provided);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }
}
