import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@pegah/ui";
import { PageShell, PaymentNotice } from "@/components/shop/page-shell";
import { ensure, serverApi } from "@/lib/api-server";
import type { Locale } from "@/i18n/locales";
import { dhakaDateTime, localName, money } from "@/lib/format";
import { matchDestination, photoFor } from "@/lib/trip";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("tours"))("title") };
}
export const dynamic = "force-dynamic";

export default async function ToursPage({
  searchParams,
}: {
  searchParams: Promise<{ where?: string }>;
}) {
  const { where } = await searchParams;
  const t = await getTranslations("tours");
  const locale = (await getLocale()) as Locale;
  const api = await serverApi();
  const { items: tours } = ensure(await api.GET("/api/v1/tours"));
  const places = [
    ...new Map(tours.map((t) => [t.destination.slug, { ...t.destination, region: "" }])).values(),
  ];
  const place = matchDestination(where, places);
  const shown = place ? tours.filter((t) => t.destination.slug === place.slug) : tours;

  return (
    <PageShell>
      <div className="grid gap-6">
        <div>
          <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-primary-ink">
            {t("eyebrow")}
          </p>
          <h1 className="mt-1.5 font-display text-[clamp(2rem,3.6vw,3rem)] font-medium leading-tight">
            {place ? t("inPlace", { name: place.name }) : t("title")}
          </h1>
          <p className="mt-1 max-w-[70ch] text-ink-2">{t("intro")}</p>
        </div>

        <nav aria-label={t("filter")} className="flex flex-wrap gap-2">
          <Link
            href="/tours"
            aria-current={!place ? "page" : undefined}
            className={`rounded-full border px-3.5 py-1.5 text-[0.84rem] font-semibold no-underline ${!place ? "border-primary bg-primary text-on-primary" : "border-rule text-ink-2 hover:border-ink"}`}
          >
            {t("all")}
          </Link>
          {places.map((p) => (
            <Link
              key={p.slug}
              href={`/tours?where=${p.slug}`}
              aria-current={place?.slug === p.slug ? "page" : undefined}
              className={`rounded-full border px-3.5 py-1.5 text-[0.84rem] font-semibold no-underline ${place?.slug === p.slug ? "border-primary bg-primary text-on-primary" : "border-rule text-ink-2 hover:border-ink"}`}
            >
              {p.name}
            </Link>
          ))}
        </nav>

        {where && !place && (
          <p className="rounded-[12px] bg-warn-soft px-4 py-3 text-[0.9rem] text-warn">
            {t("unknownWhere", { where })}
          </p>
        )}

        {shown.length === 0 ? (
          <p className="panel px-6 py-14 text-center text-ink-2">{t("noneOnSale")}</p>
        ) : (
          <ul className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {shown.map((tour) => (
              <li key={tour.id}>
                <article className="panel group relative flex h-full flex-col overflow-hidden">
                  <div className="relative aspect-[4/3]">
                    <Image
                      src={photoFor(tour.slug, tour.destination.slug)}
                      alt=""
                      fill
                      sizes="(min-width: 1280px) 400px, (min-width: 768px) 50vw, 100vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                    <span className="absolute left-3 top-3 rounded-full bg-card/95 px-3 py-1 text-[0.76rem] font-semibold text-ink">
                      {t("duration", { days: tour.durationDays, nights: tour.durationNights })}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <p className="text-[0.78rem] text-ink-3">{tour.destination.name}</p>
                    <h2 className="mt-1 font-display text-[1.45rem] font-medium leading-tight">
                      <Link
                        href={`/tours/${tour.slug}`}
                        className="no-underline after:absolute after:inset-0 hover:underline"
                      >
                        {localName(locale, tour.title, tour.titleBn)}
                      </Link>
                    </h2>
                    <p className="mt-2 line-clamp-2 flex-1 text-[0.9rem] text-ink-2">
                      {tour.summary}
                    </p>
                    <div className="mt-4 flex items-end justify-between gap-3 border-t border-rule pt-4">
                      <p className="text-[0.78rem] text-ink-3">
                        {tour.nextDepartureAt ? (
                          <>
                            {t("next")}{" "}
                            <b className="text-ink">
                              {dhakaDateTime(tour.nextDepartureAt, locale)}
                            </b>
                          </>
                        ) : (
                          t("noDepartures")
                        )}
                      </p>
                      {tour.fromPrice && (
                        <p className="text-right">
                          <span className="block text-[0.72rem] text-ink-3">
                            {t("fromPerAdult")}
                          </span>
                          <span className="tabular font-display text-[1.35rem] font-medium">
                            {money(tour.fromPrice)}
                          </span>
                        </p>
                      )}
                    </div>
                    <span className="mt-3 inline-flex items-center gap-1 text-[0.86rem] font-semibold text-primary-ink">
                      {t("seeDepartures")} <Icon name="arrowRight" className="size-4" />
                    </span>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
        <PaymentNotice />
      </div>
    </PageShell>
  );
}
