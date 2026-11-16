import Image from "next/image";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import type { Schemas } from "@pegah/api-client";
import { Icon } from "@pegah/ui";
import type { Locale } from "@/i18n/locales";
import { dhakaDateTime, localName, money } from "@/lib/format";
import { isLibraryImage, isLowRes } from "@/lib/media";
import { photoFor } from "@/lib/trip";

type Tour = Schemas["TourSummary_Output"];

/**
 * A tour in a list: photo, duration and type, title, summary, and either
 * the next departure with its price or the guide price for tours sold on
 * request. The whole card is one link.
 */
export async function TourCard({ tour, headingLevel = 2 }: { tour: Tour; headingLevel?: 2 | 3 }) {
  const t = await getTranslations("tours");
  const locale = (await getLocale()) as Locale;
  // Old-website photos are often 480 px wide and blur on a card; a licensed
  // HD photo of the destination stands in until a sharp one is uploaded.
  const hd = tour.hero && !isLowRes(tour.hero) ? tour.hero : null;
  const src = hd?.url ?? photoFor(tour.slug, tour.destination.slug);
  const H = headingLevel === 2 ? "h2" : "h3";
  const price = tour.fromPrice ?? tour.guidePrice;

  return (
    <article className="panel group relative flex h-full flex-col overflow-hidden transition-shadow hover:shadow-lift">
      <div className="relative aspect-[4/3] overflow-hidden bg-paper-2">
        <Image
          src={src}
          alt={hd?.alt ?? ""}
          fill
          unoptimized={isLibraryImage(src)}
          sizes="(min-width: 1280px) 400px, (min-width: 768px) 50vw, 100vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-card/95 px-3 py-1 text-[0.76rem] font-semibold text-ink">
          <Icon name="calendar" className="size-3.5 text-primary-ink" />
          {t("duration", { days: tour.durationDays, nights: tour.durationNights })}
        </span>
        {tour.guideWasPrice && !tour.fromPrice && (
          <span className="absolute right-3 top-3 rounded-full bg-primary px-2.5 py-1 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-on-primary">
            {t("deal")}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="flex flex-wrap items-center gap-x-2 text-[0.78rem] text-ink-3">
          <span className="inline-flex items-center gap-1">
            <Icon name="pin" className="size-3.5" />
            {tour.destination.name}
          </span>
          {tour.tourType && (
            <>
              <span aria-hidden>·</span>
              <span>{tour.tourType}</span>
            </>
          )}
        </p>
        <H className="mt-1.5 font-display text-[1.4rem] font-medium leading-tight">
          <Link
            href={`/tours/${tour.slug}`}
            className="no-underline after:absolute after:inset-0 hover:underline"
          >
            {localName(locale, tour.title, tour.titleBn)}
          </Link>
        </H>
        <p className="mt-2 line-clamp-2 flex-1 text-[0.9rem] text-ink-2">{tour.summary}</p>
        <div className="mt-4 flex items-end justify-between gap-3 border-t border-rule pt-4">
          <p className="text-[0.78rem] text-ink-3">
            {tour.nextDepartureAt ? (
              <>
                {t("next")}{" "}
                <b className="text-ink">{dhakaDateTime(tour.nextDepartureAt, locale)}</b>
              </>
            ) : (
              t("onRequest")
            )}
          </p>
          {price && (
            <p className="text-right">
              <span className="block text-[0.72rem] text-ink-3">
                {tour.fromPrice ? t("fromPerAdult") : t("guideFrom")}
              </span>
              {tour.guideWasPrice && !tour.fromPrice && (
                <span className="tabular mr-1.5 text-[0.84rem] text-ink-3 line-through">
                  {money(tour.guideWasPrice)}
                </span>
              )}
              <span className="tabular font-display text-[1.35rem] font-medium">
                {money(price)}
              </span>
            </p>
          )}
        </div>
        <span className="mt-3 inline-flex items-center gap-1 text-[0.86rem] font-semibold text-primary-ink">
          {t("seeTour")} <Icon name="arrowRight" className="size-4" />
        </span>
      </div>
    </article>
  );
}
