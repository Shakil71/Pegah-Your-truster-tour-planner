import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageShell } from "@/components/shop/page-shell";
import { ForgotForm } from "./forgot-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("auth"))("forgotTitle"), robots: { index: false } };
}

export default async function ForgotPasswordPage() {
  const t = await getTranslations("auth");
  return (
    <PageShell>
      <div className="panel mx-auto grid max-w-[520px] gap-2 p-6 md:p-10">
        <h1 className="font-display text-[2rem] font-medium">{t("forgot")}</h1>
        <p className="text-ink-2">{t("forgotIntro")}</p>
        <ForgotForm />
      </div>
    </PageShell>
  );
}
