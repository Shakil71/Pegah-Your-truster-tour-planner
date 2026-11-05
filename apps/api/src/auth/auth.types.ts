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
  /** PARTNER sessions only: the active partner company the user acts for. */
  partner?: AuthPartner;
}

export interface AuthPartner {
  id: bigint;
  publicId: string;
  kind: "SUPPLIER" | "AGENT";
  name: string;
  commissionBps: number;
}

declare module "fastify" {
  interface FastifyRequest {
    auth?: AuthContext;
  }
}
