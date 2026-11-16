import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Icon, buttonClass } from "@pegah/ui";
import { HeroPhoto } from "@/components/shop/hero-photo";
import { OfferSections } from "@/components/shop/offer-sections";
import { PageShell } from "@/components/shop/page-shell";
import type { Locale } from "@/i18n/locales";
import { getCustomer, serverApi } from "@/lib/api-server";
import { calendarDate, money } from "@/lib/format";
import { isLowRes } from "@/lib/media";
import { offerFacts, offerSections, wholeSentences } from "@/lib/offer-details";
import { cleanText } from "@/lib/text";
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
    ? {
        title: cleanText(bn ? o.titleBn : o.titleEn),
        description: wholeSentences(bn ? o.summaryBn : o.summaryEn),
      }
    : {};
}

type IconName = Parameters<typeof Icon>[0]["name"];

export default async function OfferPage({ params }: Props) {
  const { slug } = await params;
  const o = await load(slug);
  if (!o) notFound();
  const t = await getTranslations("offers");
  const locale = (await getLocale()) as Locale;
  const bn = locale === "bn";
  const session = await getCustomer();
  const api = await serverApi();
  const general = (await api.GET("/api/v1/site")).data?.general;

  const title = cleanText(bn ? o.titleBn : o.titleEn);
  const summary = wholeSentences(bn ? o.summaryBn : o.summaryEn);
  const sections = offerSections(bn ? o.detailsBn : o.detailsEn);
  const facts = offerFacts(o.titleEn, o.summaryEn, sections);

  const tiles: Array<{ icon: IconName; label: string; value: string }> = [
    ...(facts.days
      ? [
          {
            icon: "calendar" as const,
            label: t("facts.duration"),
            value: t("facts.days", { count: facts.days }),
          },
        ]
      : []),
    ...facts.nights.map((n) => ({
      icon: "building" as const,
      label: n.city,
      value: t("facts.nights", { count: n.count }),
    })),
    ...(facts.visa
      ? [{ icon: "doc" as const, label: t("facts.visa"), value: t("facts.included") }]
      : []),
    ...(facts.flights
      ? [{ icon: "plane" as const, label: t("facts.flights"), value: t("facts.included") }]
      : []),
    ...(facts.meals
      ? [{ icon: "cup" as const, label: t("facts.meals"), value: t("facts.included") }]
      : []),
    ...(facts.transport
      ? [{ icon: "car" as const, label: t("facts.transport"), value: t("facts.included") }]
      : []),
    ...(facts.insurance
      ? [{ icon: "shield" as const, label: t("facts.insurance"), value: t("facts.included") }]
      : []),
  ];

  const ask = encodeURIComponent(t("askMessage", { offer: title }));
  const whatsapp = general?.whatsapp.replace(/[^\d]/g, "");

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
          <HeroPhoto media={o.hero} fallback={photoFor(o.slug)} />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_25%,rgb(10_12_28/0.9))]" />
          <div
            className={`relative flex min-h-[340px] flex-col justify-end p-6 md:min-h-[440px] md:p-10 ${isLowRes(o.hero) ? "md:max-w-[56%]" : ""}`}
          >
            <p className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-[0.72rem] font-bold uppercase tracking-[0.14em] text-on-primary">
              <Icon name="tag" className="size-3.5" /> {t("badge")}
            </p>
            <h1 className="mt-3 max-w-[22ch] font-display text-[clamp(2.2rem,4.4vw,3.6rem)] font-medium leading-[1.02]">
              {title}
            </h1>
            <p className="mt-3 max-w-[62ch] text-[1.02rem] leading-relaxed text-white/85">
              {summary}
            </p>
            <p className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-[0.84rem] text-white/75">{t("from")}</span>
              <span className="tabular font-display text-[2rem] font-medium leading-none">
                {money(o.price)}
              </span>
              {o.originalPrice && (
                <span className="tabular text-[0.95rem] text-white/60 line-through">
                  {money(o.originalPrice)}
                </span>
              )}
              <span className="text-[0.84rem] text-white/75">{t("perPerson")}</span>
            </p>
          </div>
        </section>

        {tiles.length > 0 && (
          <ul
            aria-label={t("facts.title")}
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7"
          >
            {tiles.map((f) => (
              <li key={`${f.label}-${f.value}`} className="panel flex items-center gap-3 p-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary-ink">
                  <Icon name={f.icon} className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[0.74rem] uppercase tracking-[0.08em] text-ink-3">
                    {f.label}
                  </span>
                  <span className="block font-semibold text-ink">{f.value}</span>
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="grid content-start gap-5">
            {sections.length > 0 ? (
              <OfferSections sections={sections} />
            ) : (
              <p className="panel p-6 text-ink-2">{t("noDetails")}</p>
            )}
          </div>

          <aside className="grid content-start gap-4 lg:sticky lg:top-[96px]">
            <section className="panel overflow-hidden" aria-labelledby="offer-buy">
              <div className="border-b border-rule bg-paper-2/60 p-5 md:p-6">
                <h2
                  id="offer-buy"
                  className="text-[0.78rem] font-bold uppercase tracking-[0.12em] text-ink-3"
                >
                  {t("buyTitle")}
                </h2>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <div>
                    {o.originalPrice && (
                      <p className="tabular text-[0.86rem] text-ink-3 line-through">
                        {t("was", { price: money(o.originalPrice) })}
                      </p>
                    )}
                    <p className="tabular font-display text-[2.1rem] font-medium leading-none">
                      {money(o.price)}
                    </p>
                    <p className="mt-1 text-[0.78rem] text-ink-3">{t("perPerson")}</p>
                  </div>
                  {o.validUntil && (
                    <p className="rounded-full bg-warn-soft px-3 py-1 text-right text-[0.78rem] font-semibold text-warn">
                      {t("until", { date: calendarDate(o.validUntil.slice(0, 10), locale) })}
                    </p>
                  )}
                </div>
                {o.remaining !== null && o.remaining <= 10 && o.available && (
                  <p className="mt-2 text-[0.8rem] font-semibold text-warn">
                    {t("left", { count: o.remaining })}
                  </p>
                )}
              </div>
              <div className="p-5 md:p-6">
                {!o.available ? (
                  <p className="rounded-[12px] bg-paper-2 px-4 py-3 font-semibold text-ink-2">
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
                    className={buttonClass("primary", "md", "w-full no-underline")}
                  >
                    {t("signInFirst")}
                  </Link>
                )}
                <ol className="mt-5 grid gap-2.5 text-[0.84rem] text-ink-2">
                  {(["order", "confirm", "pay"] as const).map((step, i) => (
                    <li key={step} className="flex items-start gap-2.5">
                      <span className="tabular grid size-6 shrink-0 place-items-center rounded-full bg-paper-2 text-[0.76rem] font-bold text-ink">
                        {i + 1}
                      </span>
                      <span className="pt-0.5">{t(`steps.${step}`)}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </section>

            {general && (whatsapp || general.supportPhone) && (
              <section className="panel p-5 md:p-6">
                <h2 className="font-semibold">{t("questions")}</h2>
                <p className="mt-1 text-[0.86rem] text-ink-2">{t("questionsHint")}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {whatsapp && (
                    <a
                      href={`https://wa.me/${whatsapp}?text=${ask}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={buttonClass("primary", "sm", "no-underline")}
                    >
                      {t("askOnWhatsApp")}
                    </a>
                  )}
                  {general.supportPhone && (
                    <a
                      href={`tel:${general.supportPhone.replace(/[^\d+]/g, "")}`}
                      className={buttonClass("outline", "sm", "no-underline")}
                    >
                      {t("callUs", { phone: general.supportPhone })}
                    </a>
                  )}
                </div>
              </section>
            )}
          </aside>
        </div>
      </div>
    </PageShell>
  );
}
