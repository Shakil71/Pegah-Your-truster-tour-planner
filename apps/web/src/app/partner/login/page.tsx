import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@pegah/ui";
import { getPartner } from "@/lib/api-server";
import { PartnerLoginForm } from "./login-form";

export const metadata: Metadata = { title: "Partner sign in", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PartnerLoginPage() {
  if (await getPartner()) redirect("/partner");
  return (
    <main className="grid min-h-dvh place-items-center bg-night px-4 py-12">
      <div className="w-full max-w-[420px] rounded-card bg-card p-6 md:p-8">
        <Logo className="h-14" />
        <p className="mt-6 text-[0.72rem] font-bold uppercase tracking-[0.16em] text-primary-ink">
          Partner portal
        </p>
        <h1 className="mt-1 font-display text-[1.9rem] font-medium leading-tight">Sign in</h1>
        <p className="mt-1 text-[0.92rem] text-ink-2">
          For hotels, tour operators and travel agents working with Pegah. Accounts are created by
          the Pegah team.
        </p>
        <PartnerLoginForm />
      </div>
    </main>
  );
}
