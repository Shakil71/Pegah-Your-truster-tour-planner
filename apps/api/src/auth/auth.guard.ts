import { CanActivate, ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { CSRF_HEADER, type Permission } from "@pegah/contracts";
import type { FastifyRequest } from "fastify";
import { ProblemException } from "../common/problem";
import { APP_CONFIG, type AppConfig } from "../config/config";
import { IS_PUBLIC, IS_STAFF, REQUIRED_PERMISSIONS, SKIP_ORIGIN_CHECK } from "./decorators";
import { SessionService } from "./session.service";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Global guard, in order:
 *  1. Origin allow-list on state-changing requests (CSRF defence in depth).
 *  2. Session from the customer or staff cookie.
 *  3. Authentication unless @Public.
 *  4. CSRF token on cookie-authenticated mutations.
 *  5. Permission check for @RequirePermissions (staff only).
 * Authorization is always decided here on the server; UI hiding is cosmetic.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly allowedOrigins: Set<string>;

  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(APP_CONFIG) config: AppConfig,
  ) {
    this.allowedOrigins = new Set(config.APP_ORIGINS.map((o) => new URL(o).origin));
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== "http") return true;
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const targets = [context.getHandler(), context.getClass()];
    const flag = (key: string) => this.reflector.getAllAndOverride<boolean>(key, targets) === true;

    const unsafe = !SAFE_METHODS.has(request.method);

    if (unsafe && !flag(SKIP_ORIGIN_CHECK)) {
      const origin = request.headers.origin;
      if (origin !== undefined && !this.allowedOrigins.has(origin)) {
        throw new ProblemException(403, "origin-not-allowed", "Origin not allowed");
      }
    }

    const required =
      this.reflector.getAllAndOverride<Permission[] | undefined>(REQUIRED_PERMISSIONS, targets) ??
      [];
    const kind = flag(IS_STAFF) || required.length > 0 ? "STAFF" : "CUSTOMER";
    const token = request.cookies?.[this.sessions.cookieName(kind)];
    const auth = await this.sessions.resolve(token, kind);
    if (auth) request.auth = auth;

    if (flag(IS_PUBLIC)) return true;

    if (!auth) {
      throw new ProblemException(
        401,
        "unauthenticated",
        "Authentication required",
        "Please sign in.",
      );
    }

    if (unsafe) {
      const header = request.headers[CSRF_HEADER];
      const provided = Array.isArray(header) ? header[0] : header;
      if (!this.sessions.verifyCsrf(auth.tokenHash, provided)) {
        throw new ProblemException(403, "csrf-invalid", "Missing or invalid CSRF token");
      }
    }

    const missing = required.filter((p) => !auth.permissions.includes(p));
    if (missing.length > 0) {
      throw new ProblemException(
        403,
        "forbidden",
        "Forbidden",
        "Your role does not allow this action.",
      );
    }
    return true;
  }
}
