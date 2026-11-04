import type { Metadata } from "next";
import { PageShell } from "@/components/shop/page-shell";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Forgot password", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <PageShell>
      <div className="panel mx-auto grid max-w-[520px] gap-2 p-6 md:p-10">
        <h1 className="font-display text-[2rem] font-medium">Forgot your password?</h1>
        <p className="text-ink-2">
          Enter your email and we will send a link to choose a new one. The link works for 30
          minutes.
        </p>
        <ForgotForm />
      </div>
    </PageShell>
  );
}
