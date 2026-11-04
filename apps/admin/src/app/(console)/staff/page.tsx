import type { Metadata } from "next";
import { NoAccess } from "@/components/no-access";
import { ensure, requireStaff, serverApi } from "@/lib/api-server";
import { StaffManager } from "./staff-manager";

export const metadata: Metadata = { title: "Staff and roles" };

export default async function StaffPage() {
  const session = await requireStaff();
  if (!session.user.permissions.includes("user:manage")) {
    return <NoAccess what="staff accounts" permission="user:manage" />;
  }
  const api = await serverApi();
  const data = ensure(await api.GET("/api/v1/admin/staff"));

  return (
    <div className="mx-auto grid max-w-[1440px] gap-6">
      <div className="animate-rise">
        <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-primary-ink">
          System
        </p>
        <h1 className="mt-1.5 font-display text-[clamp(1.9rem,3vw,2.5rem)] font-medium leading-tight">
          Staff and roles
        </h1>
        <p className="mt-1 max-w-[70ch] text-ink-2">
          Who can sign in to the back office and what each role allows. Every change is written to
          the audit log. Only an owner can grant or remove the owner role.
        </p>
      </div>
      <StaffManager
        staff={data.items}
        roles={data.roles}
        me={session.user.id}
        isOwner={session.user.roles.includes("owner")}
        csrfToken={session.csrfToken}
      />
    </div>
  );
}
