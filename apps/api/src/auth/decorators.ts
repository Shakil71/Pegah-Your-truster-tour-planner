import { createParamDecorator, ExecutionContext, SetMetadata } from "@nestjs/common";
import type { Permission } from "@pegah/contracts";
import type { FastifyRequest } from "fastify";
import type { AuthContext } from "./auth.types";

export const IS_PUBLIC = "pegah:isPublic";
export const IS_STAFF = "pegah:isStaff";
export const REQUIRED_PERMISSIONS = "pegah:permissions";
export const SKIP_ORIGIN_CHECK = "pegah:skipOriginCheck";

/** No session required (a session is still resolved if present). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Route uses the staff session cookie and requires a STAFF session. */
export const Staff = () => SetMetadata(IS_STAFF, true);

/** Requires a staff session holding every listed permission. */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(REQUIRED_PERMISSIONS, permissions);

/** For server-to-server callbacks (payment webhooks) verified by signature instead. */
export const SkipOriginCheck = () => SetMetadata(SKIP_ORIGIN_CHECK, true);

/** The verified session; only use on routes that are not @Public. */
export const CurrentAuth = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthContext => {
    const auth = ctx.switchToHttp().getRequest<FastifyRequest>().auth;
    if (!auth) throw new Error("CurrentAuth used on a route without a session");
    return auth;
  },
);
