import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@pegah/ui";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Forgot password", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-paper px-4 py-12">
      <div className="w-full max-w-[420px] rounded-card bg-card p-6 shadow-lift md:p-8">
        <Logo className="h-12" />
        <h1 className="mt-6 font-display text-[1.9rem] font-medium leading-tight">
          Forgot your password?
        </h1>
        <p className="mt-2 text-ink-2">
          Enter your work email. If it belongs to an active staff account, we will email a link to
          choose a new password. The link works for 30 minutes, once.
        </p>
        <ForgotForm />
        <Link
          href="/login"
          className="mt-6 inline-block text-[0.88rem] font-semibold text-primary-ink"
        >
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
