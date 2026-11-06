import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageShell } from "@/components/shop/page-shell";
import { BalanceForm } from "./balance-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("giftCards"))("balanceTitle"), robots: { index: false } };
}

export default async function GiftCardBalancePage() {
  const t = await getTranslations("giftCards");
  return (
    <PageShell>
      <div className="mx-auto grid max-w-[560px] gap-3">
        <h1 className="font-display text-[clamp(2rem,3.6vw,2.8rem)] font-medium">
          {t("balanceTitle")}
        </h1>
        <p className="text-ink-2">{t("balanceIntro")}</p>
        <BalanceForm />
      </div>
    </PageShell>
  );
}
