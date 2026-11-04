"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Schemas } from "@pegah/api-client";

type Session = Schemas["SessionResponseDto_Output"];

const StaffContext = createContext<Session | null>(null);

export function StaffProvider({ session, children }: { session: Session; children: ReactNode }) {
  return <StaffContext.Provider value={session}>{children}</StaffContext.Provider>;
}

/** The signed-in staff member. Permission checks here only hide controls; the API decides. */
export function useStaff(): Session & { can: (permission: string) => boolean } {
  const session = useContext(StaffContext);
  if (!session) throw new Error("useStaff outside StaffProvider");
  return {
    ...session,
    can: (permission: string) => (session.user.permissions as string[]).includes(permission),
  };
}
