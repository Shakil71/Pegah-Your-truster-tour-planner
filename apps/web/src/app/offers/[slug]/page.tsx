import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Icon, buttonClass } from "@pegah/ui";
import { PageShell } from "@/components/shop/page-shell";
import type { Locale } from "@/i18n/locales";
import { getCustomer, serverApi } from "@/lib/api-server";
import { calendarDate, money } from "@/lib/format";
import { photoFor } from "@/lib/trip";
import { OfferOrderForm } from "./offer-order-form";

type Props = { params: Promise<{ slug: string }> };
export const dynamic = "force-dynamic";

async function load(slug: string) {
  const api = await serverApi();
  return (await api.GET("/api/v1/offers/{slug}", { params: { path: { slug } } })).data ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const o = await load((await params).slug);
  const bn = (await getLocale()) === "bn";
  return o
    ? { title: bn ? o.titleBn : o.titleEn, description: bn ? o.summaryBn : o.summaryEn }
    : {};
}

export default async function OfferPage({ params }: Props) {
  const { slug } = await params;
  const o = await load(slug);
  if (!o) notFound();
  const t = await getTranslations("offers");
  const locale = (await getLocale()) as Locale;
  const bn = locale === "bn";
  const session = await getCustomer();

  return (
    <PageShell>
      <div className="grid gap-8">
        <Link
          href="/offers"
          className="inline-flex items-center gap-1 text-[0.86rem] font-semibold text-ink-2 no-underline hover:text-ink"
        >
          <Icon name="arrowLeft" className="size-4" /> {t("back")}
        </Link>
        <section className="relative overflow-hidden rounded-card bg-night text-white">
          <Image
            src={o.hero?.url ?? photoFor(o.slug)}
            alt={o.hero?.alt ?? ""}
            fill
            priority
            sizes="(min-width: 1280px) 1280px, 100vw"
            className="object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_30%,rgb(10_12_28/0.88))]" />
          <div className="relative flex min-h-[320px] flex-col justify-end p-6 md:min-h-[420px] md:p-10">
            <h1 className="max-w-[22ch] font-display text-[clamp(2.2rem,4.4vw,3.6rem)] font-medium leading-[1.02]">
              {bn ? o.titleBn : o.titleEn}
            </h1>
            <p className="mt-2 max-w-[60ch] text-white/85">{bn ? o.summaryBn : o.summaryEn}</p>
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <section className="panel p-5 md:p-6">
            <h2 className="text-[1rem] font-semibold">{t("details")}</h2>
            <p className="mt-3 whitespace-pre-line text-[0.97rem] leading-relaxed text-ink-2">
              {bn ? o.detailsBn : o.detailsEn}
            </p>
            <p className="mt-5 rounded-[12px] bg-paper-2 px-4 py-3 text-[0.86rem] text-ink-2">
              {t("howItWorks")}
            </p>
          </section>
          <aside className="grid content-start gap-4 lg:sticky lg:top-[96px]">
            <section className="panel p-5 md:p-6">
              <div className="flex items-end justify-between gap-3">
                <div>
                  {o.originalPrice && (
                    <p className="tabular text-[0.86rem] text-ink-3 line-through">
                      {t("was", { price: money(o.originalPrice) })}
                    </p>
                  )}
                  <p className="tabular font-display text-[2rem] font-medium leading-none">
                    {money(o.price)}
                  </p>
                  <p className="mt-1 text-[0.78rem] text-ink-3">{t("perPerson")}</p>
                </div>
                {o.validUntil && (
                  <p className="text-right text-[0.8rem] text-ink-2">
                    {t("until", { date: calendarDate(o.validUntil.slice(0, 10), locale) })}
                  </p>
                )}
              </div>
              {!o.available ? (
                <p className="mt-4 rounded-[12px] bg-paper-2 px-4 py-3 font-semibold text-ink-2">
                  {t("unavailable")}
                </p>
              ) : session ? (
                <OfferOrderForm
                  offerId={o.id}
                  unitPrice={o.price}
                  maxQuantity={Math.min(20, o.remaining ?? 20)}
                  csrfToken={session.csrfToken}
                  buyer={{
                    name: session.user.fullName,
                    email: session.user.email,
                    phone: session.user.phone ?? "",
                  }}
                />
              ) : (
                <Link
                  href={`/login?next=${encodeURIComponent(`/offers/${o.slug}`)}`}
                  className={buttonClass("primary", "md", "mt-4 w-full no-underline")}
                >
                  {t("signInFirst")}
                </Link>
              )}
            </section>
          </aside>
        </div>
      </div>
    </PageShell>
  );
}
