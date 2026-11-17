import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@pegah/ui";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const valid = typeof token === "string" && /^[A-Za-z0-9_-]{32,128}$/.test(token);
  return (
    <main className="grid min-h-dvh place-items-center bg-paper px-4 py-12">
      <div className="w-full max-w-[420px] rounded-card bg-card p-6 shadow-lift md:p-8">
        <Logo className="h-12" />
        <h1 className="mt-6 font-display text-[1.9rem] font-medium leading-tight">
          Choose a new password
        </h1>
        {valid ? (
          <ResetForm token={token} />
        ) : (
          <p className="mt-2 text-ink-2">
            This link is incomplete.{" "}
            <Link href="/forgot-password" className="font-semibold text-primary-ink">
              Ask for a new link
            </Link>
            .
          </p>
        )}
      </div>
    </main>
  );
}
