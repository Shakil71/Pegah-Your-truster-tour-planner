import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/shop/page-shell";
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
    <PageShell>
      <div className="panel mx-auto grid max-w-[520px] gap-2 p-6 md:p-10">
        <h1 className="font-display text-[2rem] font-medium">Choose a new password</h1>
        {valid ? (
          <ResetForm token={token} />
        ) : (
          <p className="text-ink-2">
            This link is incomplete.{" "}
            <Link href="/forgot-password" className="font-semibold text-primary-ink">
              Ask for a new one
            </Link>
            .
          </p>
        )}
      </div>
    </PageShell>
  );
}
