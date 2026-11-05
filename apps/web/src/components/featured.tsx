import Image from "next/image";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import type { Schemas } from "@pegah/api-client";
import { Icon } from "@pegah/ui";
import type { Locale } from "@/i18n/locales";
import { dhakaDateTime, localName, money } from "@/lib/format";
import { photoFor } from "@/lib/trip";
import { SectionHead } from "./section-head";

type Home = Schemas["PublicHomeDto_Output"];
const gutter = "px-[max(16px,env(safe-area-inset-left,0px))]";

/** Destinations chosen in the console (ADR-0031). */
export async function FeaturedDestinations({
  items,
  season,
}: {
  items: Home["destinations"];
  season: string;
}) {
  const t = await getTranslations("home");
  const locale = (await getLocale()) as Locale;
  return (
    <section className={`${gutter} pt-24`} aria-labelledby="trend-h">
      <div className="mx-auto max-w-[1280px]">
        <SectionHead
          id="trend-h"
          eyebrow={t("trendingEyebrow", { season })}
          title={t.rich("trendingTitle", { em: (chunks) => <em>{chunks}</em> })}
        />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((d) => (
            <li key={d.slug}>
              <Link
                href={`/stays?where=${d.slug}`}
                className="group relative block aspect-[3/4] overflow-hidden rounded-card bg-night text-white no-underline"
              >
                <Image
                  src={d.hero?.url ?? photoFor(d.slug)}
                  alt={d.hero?.alt ?? ""}
                  fill
                  sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                  className="object-cover transition-transform duration-700 ease-pegah group-hover:scale-105"
                />
                <span className="scrim-bottom absolute inset-0" />
                <span className="absolute inset-x-[18px] bottom-[18px] z-[1] grid gap-1">
                  <span className="font-display text-[1.7rem] font-medium leading-[1.05]">
                    {localName(locale, d.name, d.nameBn)}
                  </span>
                  <span className="line-clamp-2 text-[0.84rem] opacity-85">{d.summary}</span>
                  <span className="mt-2 justify-self-start rounded-full bg-white/95 px-3 py-1 text-[0.8rem] font-semibold text-fixed-ink">
                    {t("destCounts", { stays: d.hotelCount, tours: d.tourCount })}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Hotels chosen in the console; real listings, no sample prices. */
export async function FeaturedStays({ items }: { items: Home["hotels"] }) {
  const t = await getTranslations("home");
  const locale = (await getLocale()) as Locale;
  return (
    <section id="stays" className={`${gutter} pt-28`} aria-labelledby="stays-h">
      <div className="mx-auto max-w-[1280px]">
        <SectionHead
          id="stays-h"
          eyebrow={t("staysEyebrow")}
          title={t.rich("staysTitle", { em: (chunks) => <em>{chunks}</em> })}
          aside={<p className="m-0 max-w-[42ch] text-ink-2">{t("realStaysIntro")}</p>}
        />
        <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {items.map((h) => (
            <li key={h.slug} className="group relative grid content-start gap-3">
              <div className="relative aspect-[4/3] overflow-hidden rounded-card bg-paper-2">
                <Image
                  src={h.hero?.url ?? photoFor(h.slug, h.destination.slug)}
                  alt={h.hero?.alt ?? ""}
                  fill
                  sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
                  className="object-cover transition-transform duration-700 ease-pegah group-hover:scale-105"
                />
              </div>
              <p className="text-[0.8rem] text-ink-3">
                {h.starRating ? `${"★".repeat(h.starRating)} · ` : ""}
                {h.destination.name}
              </p>
              <h3 className="-mt-2 font-display text-[1.35rem] font-medium leading-tight">
                <Link
                  href={`/stays/${h.slug}`}
                  className="no-underline after:absolute after:inset-0 hover:underline"
                >
                  {localName(locale, h.name, h.nameBn)}
                </Link>
              </h3>
              <p className="line-clamp-2 text-[0.88rem] text-ink-2">{h.summary}</p>
              <span className="inline-flex items-center gap-1 text-[0.86rem] font-semibold text-primary-ink">
                {t("seeRooms")} <Icon name="arrowRight" className="size-4" />
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Tours chosen in the console, with their real next departure and price. */
export async function FeaturedTours({ items }: { items: Home["tours"] }) {
  const t = await getTranslations("home");
  const tt = await getTranslations("tours");
  const locale = (await getLocale()) as Locale;
  return (
    <section id="tours" className={`${gutter} pt-28`} aria-labelledby="tours-h">
      <div className="mx-auto max-w-[1280px]">
        <SectionHead
          id="tours-h"
          eyebrow={t("toursEyebrow")}
          title={t.rich("toursTitle", { em: (chunks) => <em>{chunks}</em> })}
          aside={<p className="m-0 max-w-[42ch] text-ink-2">{t("toursIntro")}</p>}
        />
        <ul className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {items.map((tour) => (
            <li key={tour.slug} className="panel group relative flex flex-col overflow-hidden">
              <div className="relative aspect-[16/10]">
                <Image
                  src={tour.hero?.url ?? photoFor(tour.slug, tour.destination.slug)}
                  alt={tour.hero?.alt ?? ""}
                  fill
                  sizes="(min-width: 1280px) 400px, (min-width: 768px) 50vw, 100vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
                <span className="absolute left-3 top-3 rounded-full bg-card/95 px-3 py-1 text-[0.76rem] font-semibold text-ink">
                  {tt("duration", { days: tour.durationDays, nights: tour.durationNights })}
                </span>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <p className="text-[0.78rem] text-ink-3">{tour.destination.name}</p>
                <h3 className="mt-1 font-display text-[1.4rem] font-medium leading-tight">
                  <Link
                    href={`/tours/${tour.slug}`}
                    className="no-underline after:absolute after:inset-0 hover:underline"
                  >
                    {localName(locale, tour.title, tour.titleBn)}
                  </Link>
                </h3>
                <p className="mt-2 line-clamp-2 flex-1 text-[0.9rem] text-ink-2">{tour.summary}</p>
                <div className="mt-4 flex items-end justify-between gap-3 border-t border-rule pt-4 text-[0.8rem] text-ink-3">
                  <span>
                    {tour.nextDepartureAt
                      ? `${tt("next")} ${dhakaDateTime(tour.nextDepartureAt, locale)}`
                      : tt("noDepartures")}
                  </span>
                  {tour.fromPrice && (
                    <span className="text-right">
                      <span className="block">{tt("fromPerAdult")}</span>
                      <span className="tabular font-display text-[1.25rem] font-medium text-ink">
                        {money(tour.fromPrice)}
                      </span>
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
