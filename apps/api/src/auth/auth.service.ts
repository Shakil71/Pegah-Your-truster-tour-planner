import { Inject, Injectable, Logger } from "@nestjs/common";
import type { LoginRequest, RegisterRequest, SessionKind, SessionResponse } from "@pegah/contracts";
import { Prisma } from "@pegah/db";
import { AuditService } from "../audit/audit.service";
import { newPublicId } from "../common/ids";
import { ProblemException } from "../common/problem";
import { PRISMA, type Db } from "../prisma/prisma.service";
import type { AuthContext } from "./auth.types";
import { PasswordService } from "./password.service";
import { SessionService, type SessionMeta } from "./session.service";

export interface IssuedSession {
  token: string;
  maxAgeSeconds: number;
  response: SessionResponse;
}

const INVALID_CREDENTIALS = () =>
  new ProblemException(
    401,
    "invalid-credentials",
    "Invalid email or password",
    "The email or password is incorrect.",
  );

@Injectable()
export class AuthService {
  private readonly logger = new Logger("Auth");

  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  /** Creates a customer account and signs it in. */
  async register(input: RegisterRequest, meta: SessionMeta): Promise<IssuedSession> {
    const passwordHash = await this.passwords.hash(input.password);
    try {
      const { user, session } = await this.db.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            publicId: newPublicId(),
            email: input.email,
            passwordHash,
            fullName: input.fullName,
            phone: input.phone ?? null,
            kind: "CUSTOMER",
          },
        });
        const session = await this.sessions.create(user.id, "CUSTOMER", meta, tx);
        return { user, session };
      });
      return {
        token: session.token,
        maxAgeSeconds: session.maxAgeSeconds,
        response: {
          user: {
            id: user.publicId,
            email: user.email,
            fullName: user.fullName,
            phone: user.phone,
            kind: "CUSTOMER",
            roles: [],
            permissions: [],
            partner: null,
          },
          csrfToken: this.sessions.csrfToken(session.tokenHash),
        },
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ProblemException(
          409,
          "email-taken",
          "Email already registered",
          "An account with this email already exists. Try signing in.",
        );
      }
      throw error;
    }
  }

  /** Verifies credentials and opens a customer or staff session. */
  async login(input: LoginRequest, kind: SessionKind, meta: SessionMeta): Promise<IssuedSession> {
    const user = await this.db.user.findUnique({
      where: { email: input.email },
      include: { partner: true },
    });
    const valid = user
      ? await this.passwords.verify(user.passwordHash, input.password)
      : await this.passwords.verifyAgainstDummy(input.password);

    const allowed =
      valid &&
      user !== null &&
      user.status === "ACTIVE" &&
      // Each portal accepts only its own kind of account.
      ((kind === "CUSTOMER" && user.kind === "CUSTOMER") ||
        (kind === "STAFF" && user.kind === "STAFF") ||
        (kind === "PARTNER" && user.kind === "PARTNER" && user.partner?.status === "ACTIVE"));

    if (kind === "STAFF" || kind === "PARTNER") {
      const who = kind === "STAFF" ? "staff" : "partner";
      await this.audit.record({
        actorType: kind,
        actorUserId: allowed ? user!.id : null,
        action: allowed ? `auth.${who}_login.succeeded` : `auth.${who}_login.failed`,
        targetType: "user",
        targetId: allowed ? user!.publicId : undefined,
        ipAddress: meta.ipAddress,
        ...(allowed ? {} : { metadata: { email: input.email } }),
      });
    }
    if (!allowed || !user) throw INVALID_CREDENTIALS();

    const session = await this.db.$transaction(async (tx) => {
      const s = await this.sessions.create(user.id, kind, meta, tx);
      await tx.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
      return s;
    });

    if (this.passwords.needsRehash(user.passwordHash)) {
      // Upgrade the stored hash after cost parameters are raised. Best effort.
      try {
        const passwordHash = await this.passwords.hash(input.password);
        await this.db.user.update({ where: { id: user.id }, data: { passwordHash } });
      } catch (error) {
        this.logger.warn({ err: error }, "Password rehash failed");
      }
    }

    const access =
      kind === "STAFF" ? await this.sessions.loadAccess(user.id) : { roles: [], permissions: [] };
    return {
      token: session.token,
      maxAgeSeconds: session.maxAgeSeconds,
      response: {
        user: {
          id: user.publicId,
          email: user.email,
          fullName: user.fullName,
          phone: user.phone,
          kind,
          ...access,
          partner:
            kind === "PARTNER" && user.partner
              ? {
                  id: user.partner.publicId,
                  kind: user.partner.kind,
                  name: user.partner.name,
                  commissionBps: user.partner.commissionBps,
                }
              : null,
        },
        csrfToken: this.sessions.csrfToken(session.tokenHash),
      },
    };
  }

  async logout(auth: AuthContext): Promise<void> {
    await this.sessions.revoke(auth.sessionId);
  }

  toSessionResponse(auth: AuthContext): SessionResponse {
    return {
      user: {
        id: auth.user.publicId,
        email: auth.user.email,
        fullName: auth.user.fullName,
        phone: auth.user.phone,
        kind: auth.kind,
        roles: auth.roles,
        permissions: auth.permissions,
        partner: auth.partner
          ? {
              id: auth.partner.publicId,
              kind: auth.partner.kind,
              name: auth.partner.name,
              commissionBps: auth.partner.commissionBps,
            }
          : null,
      },
      csrfToken: this.sessions.csrfToken(auth.tokenHash),
    };
  }
}
