import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Logo } from "@pegah/ui";
import { LanguageSwitch } from "@/components/language-switch";
import { getPartner } from "@/lib/api-server";
import { PartnerLoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: (await getTranslations("partner"))("login.metaTitle"),
    robots: { index: false },
  };
}
export const dynamic = "force-dynamic";

export default async function PartnerLoginPage() {
  if (await getPartner()) redirect("/partner");
  const t = await getTranslations("partner");
  return (
    <main className="grid min-h-dvh place-items-center bg-night px-4 py-12">
      <div className="w-full max-w-[420px] rounded-card bg-card p-6 md:p-8">
        <div className="flex items-start justify-between gap-4">
          <Logo className="h-14" />
          <LanguageSwitch className="text-[0.84rem] text-ink-2" />
        </div>
        <p className="mt-6 text-[0.72rem] font-bold uppercase tracking-[0.16em] text-primary-ink">
          {t("portal")}
        </p>
        <h1 className="mt-1 font-display text-[1.9rem] font-medium leading-tight">
          {t("login.title")}
        </h1>
        <p className="mt-1 text-[0.92rem] text-ink-2">{t("login.intro")}</p>
        <PartnerLoginForm />
      </div>
    </main>
  );
}
