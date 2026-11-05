import type { Metadata } from "next";
import { PasswordForm } from "@/app/account/profile/profile-forms";
import { requirePartner } from "@/lib/api-server";

export const metadata: Metadata = { title: "Account" };

export default async function PartnerAccountPage() {
  const session = await requirePartner();
  const partner = session.user.partner!;
  return (
    <div className="grid max-w-[720px] gap-6">
      <h1 className="font-display text-[clamp(1.9rem,3vw,2.5rem)] font-medium leading-tight">
        Account
      </h1>
      <section className="panel p-5 md:p-6">
        <dl className="grid gap-3 text-[0.92rem] sm:grid-cols-2">
          <div>
            <dt className="text-[0.76rem] uppercase tracking-[0.08em] text-ink-3">You</dt>
            <dd className="mt-1">
              {session.user.fullName}
              <span className="block text-ink-2">{session.user.email}</span>
            </dd>
          </div>
          <div>
            <dt className="text-[0.76rem] uppercase tracking-[0.08em] text-ink-3">Company</dt>
            <dd className="mt-1">
              {partner.name}
              <span className="block text-ink-2">
                {partner.kind === "SUPPLIER"
                  ? "Supplier"
                  : `Agent · ${(partner.commissionBps / 100).toFixed(partner.commissionBps % 100 ? 2 : 0)}% commission`}
              </span>
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-[0.82rem] text-ink-3">
          To change company details or add colleagues, contact the Pegah team.
        </p>
      </section>
      <PasswordForm csrfToken={session.csrfToken} partner />
    </div>
  );
}
