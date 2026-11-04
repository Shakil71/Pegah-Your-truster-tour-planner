import type { Permission, SessionKind } from "@pegah/contracts";

export interface AuthUser {
  id: bigint;
  publicId: string;
  email: string;
  fullName: string;
  phone: string | null;
}

/** Attached to the request by AuthGuard once a session cookie is verified. */
export interface AuthContext {
  sessionId: bigint;
  tokenHash: string;
  kind: SessionKind;
  user: AuthUser;
  roles: string[];
  permissions: Permission[];
}

declare module "fastify" {
  interface FastifyRequest {
    auth?: AuthContext;
  }
}
