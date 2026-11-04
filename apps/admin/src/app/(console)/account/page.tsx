import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { requireStaff } from "@/lib/api-server";
import { StaffPasswordForm } from "./password-form";

export const metadata: Metadata = { title: "My account" };

export default async function MyAccountPage() {
  const session = await requireStaff();
  return (
    <div className="mx-auto grid max-w-[900px] gap-6">
      <PageHeader
        eyebrow="My account"
        title={session.user.fullName}
        intro={`${session.user.email} · ${session.user.roles.join(", ")}`}
      />
      <section className="panel p-5 md:p-6">
        <h2 className="text-[0.95rem] font-semibold">What you can do</h2>
        <p className="mt-2 flex flex-wrap gap-1.5">
          {session.user.permissions.map((p) => (
            <span
              key={p}
              className="rounded-full bg-paper-2 px-2 py-0.5 text-[0.72rem] font-semibold text-ink-2"
            >
              {p}
            </span>
          ))}
        </p>
      </section>
      <StaffPasswordForm csrfToken={session.csrfToken} />
    </div>
  );
}
