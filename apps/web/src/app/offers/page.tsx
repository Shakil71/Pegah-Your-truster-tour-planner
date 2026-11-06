import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Icon } from "@pegah/ui";
import { AdBanner } from "@/components/ad-banner";
import { PageShell } from "@/components/shop/page-shell";
import type { Locale } from "@/i18n/locales";
import { serverApi } from "@/lib/api-server";
import { calendarDate, money } from "@/lib/format";
import { photoFor } from "@/lib/trip";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("offers");
  return { title: t("title"), description: t("intro") };
}
export const dynamic = "force-dynamic";

export default async function OffersPage() {
  const t = await getTranslations("offers");
  const locale = (await getLocale()) as Locale;
  const bn = locale === "bn";
  const api = await serverApi();
  const offers = (await api.GET("/api/v1/offers")).data?.items ?? [];

  return (
    <PageShell>
      <div className="grid gap-8">
        <div>
          <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-primary-ink">
            {t("eyebrow")}
          </p>
          <h1 className="mt-1.5 font-display text-[clamp(2.2rem,4vw,3.4rem)] font-medium leading-tight [&_em]:text-primary-ink">
            {t.rich("heading", { em: (c) => <em>{c}</em> })}
          </h1>
          <p className="mt-2 max-w-[62ch] text-ink-2">{t("intro")}</p>
        </div>
        <AdBanner placement="OFFERS_TOP" />
        {offers.length === 0 ? (
          <p className="panel px-6 py-14 text-center text-ink-2">{t("none")}</p>
        ) : (
          <ul className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {offers.map((o) => (
              <li key={o.id} className="panel group relative flex flex-col overflow-hidden">
                <div className="relative aspect-[16/10]">
                  <Image
                    src={o.hero?.url ?? photoFor(o.slug)}
                    alt={o.hero?.alt ?? ""}
                    fill
                    sizes="(min-width: 1280px) 400px, (min-width: 768px) 50vw, 100vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                  {!o.available ? (
                    <span className="absolute left-3 top-3 rounded-full bg-night/85 px-3 py-1 text-[0.76rem] font-semibold text-white">
                      {t("soldOut")}
                    </span>
                  ) : o.remaining !== null && o.remaining <= 5 ? (
                    <span className="absolute left-3 top-3 rounded-full bg-primary px-3 py-1 text-[0.76rem] font-semibold text-on-primary">
                      {t("left", { count: o.remaining })}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h2 className="font-display text-[1.45rem] font-medium leading-tight">
                    <Link
                      href={`/offers/${o.slug}`}
                      className="no-underline after:absolute after:inset-0 hover:underline"
                    >
                      {bn ? o.titleBn : o.titleEn}
                    </Link>
                  </h2>
                  <p className="mt-2 line-clamp-2 flex-1 text-[0.9rem] text-ink-2">
                    {bn ? o.summaryBn : o.summaryEn}
                  </p>
                  <div className="mt-4 flex items-end justify-between gap-3 border-t border-rule pt-4">
                    <p className="text-[0.78rem] text-ink-3">
                      {o.validUntil
                        ? t("until", { date: calendarDate(o.validUntil.slice(0, 10), locale) })
                        : t("perPerson")}
                    </p>
                    <p className="text-right">
                      {o.originalPrice && (
                        <span className="tabular block text-[0.8rem] text-ink-3 line-through">
                          {t("was", { price: money(o.originalPrice) })}
                        </span>
                      )}
                      <span className="tabular font-display text-[1.45rem] font-medium">
                        {money(o.price)}
                      </span>
                    </p>
                  </div>
                  <span className="mt-3 inline-flex items-center gap-1 text-[0.86rem] font-semibold text-primary-ink">
                    {t("view")} <Icon name="arrowRight" className="size-4" />
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageShell>
  );
}
