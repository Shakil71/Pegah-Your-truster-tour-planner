import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Icon } from "@pegah/ui";
import { PageShell } from "@/components/shop/page-shell";
import type { Locale } from "@/i18n/locales";
import { serverApi } from "@/lib/api-server";
import { localName, money } from "@/lib/format";
import { photoFor } from "@/lib/trip";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("services");
  return { title: t("visaTitle"), description: t("visaIntro") };
}
export const dynamic = "force-dynamic";

export default async function VisaPage() {
  const t = await getTranslations("services");
  const locale = (await getLocale()) as Locale;
  const api = await serverApi();
  const visas = (await api.GET("/api/v1/visas")).data?.items ?? [];

  return (
    <PageShell>
      <div className="grid gap-8">
        <div>
          <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-primary-ink">
            {t("visaEyebrow")}
          </p>
          <h1 className="mt-1.5 max-w-[22ch] font-display text-[clamp(2.2rem,4vw,3.4rem)] font-medium leading-tight">
            {t("visaHeading")}
          </h1>
          <p className="mt-2 max-w-[62ch] text-ink-2">{t("visaIntro")}</p>
        </div>
        {visas.length === 0 ? (
          <p className="panel px-6 py-14 text-center text-ink-2">{t("visaNone")}</p>
        ) : (
          <ul className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {visas.map((v) => (
              <li key={v.slug} className="panel group relative flex flex-col overflow-hidden">
                <div className="relative aspect-[16/9]">
                  <Image
                    src={v.hero?.url ?? photoFor(v.slug)}
                    alt={v.hero?.alt ?? ""}
                    fill
                    sizes="(min-width: 1280px) 400px, (min-width: 768px) 50vw, 100vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <p className="text-[0.78rem] font-semibold uppercase tracking-[0.08em] text-ink-3">
                    {v.visaType}
                  </p>
                  <h2 className="font-display text-[1.5rem] font-medium leading-tight">
                    <Link
                      href={`/visa/${v.slug}`}
                      className="no-underline after:absolute after:inset-0 hover:underline"
                    >
                      {localName(locale, v.country, v.countryBn)}
                    </Link>
                  </h2>
                  <p className="mt-2 line-clamp-2 flex-1 text-[0.9rem] text-ink-2">{v.summary}</p>
                  <div className="mt-4 flex items-end justify-between gap-3 border-t border-rule pt-4 text-[0.84rem]">
                    <span className="inline-flex items-center gap-1.5 text-ink-2">
                      <Icon name="clock" className="size-4" /> {v.processingTime}
                    </span>
                    <span className="tabular font-semibold">
                      {t("feeFrom", { amount: money(v.fee) })}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageShell>
  );
}
