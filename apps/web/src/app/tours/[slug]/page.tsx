import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { Icon, buttonClass } from "@pegah/ui";
import { PageShell, PaymentNotice } from "@/components/shop/page-shell";
import { TourCard } from "@/components/shop/tour-card";
import { TourPhotos } from "@/components/shop/tour-photos";
import {
  CheckList,
  Chips,
  DescriptionBlocks,
  GroupList,
  ItineraryTimeline,
  TourSection,
} from "@/components/shop/tour-sections";
import { ensure, getPartner, serverApi } from "@/lib/api-server";
import type { Locale } from "@/i18n/locales";
import { localName, money } from "@/lib/format";
import { isLowRes } from "@/lib/media";
import { wholeSentences } from "@/lib/offer-details";
import { cleanText } from "@/lib/text";
import {
  describe,
  groups,
  itinerary,
  pickups,
  points,
  startTime,
  unique,
} from "@/lib/tour-details";
import { photoFor } from "@/lib/trip";
import { DeparturePicker } from "./departure-picker";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };
type IconName = Parameters<typeof Icon>[0]["name"];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const api = await serverApi();
  const { data } = await api.GET("/api/v1/tours/{slug}", { params: { path: { slug } } });
  if (!data) return { title: (await getTranslations("tour"))("fallbackTitle") };
  const summary = cleanText(data.summary);
  return {
    title: data.title,
    description: summary.length > 160 ? `${summary.slice(0, 157).trimEnd()}…` : summary,
  };
}

export default async function TourPage({ params }: Props) {
  const { slug } = await params;
  const api = await serverApi();
  const t = await getTranslations("tour");
  const locale = (await getLocale()) as Locale;
  const tour = ensure(await api.GET("/api/v1/tours/{slug}", { params: { path: { slug } } }));
  const [partner, site, list] = await Promise.all([
    getPartner(),
    api.GET("/api/v1/site"),
    api.GET("/api/v1/tours"),
  ]);
  const isAgent = partner?.user.partner?.kind === "AGENT";
  const general = site.data?.general;

  const title = localName(locale, tour.title, tour.titleBn);
  const summary = wholeSentences(tour.summary);
  const blocks = describe(tour.description);
  // The overview repeats the summary on imported tours; show it only when it adds something.
  const overview =
    tour.overview &&
    ![tour.summary, tour.description].some((x) => cleanText(x) === cleanText(tour.overview))
      ? describe(tour.overview)
      : [];
  const days = itinerary(tour.itinerary);
  const policy = groups(tour.policy);
  const tips = groups(tour.travelTips, /^travel tips$/i);
  const info = groups(tour.additionalInfo, /^additional info(rmation)?$/i);
  const transport = points(tour.transport);
  const places = pickups(tour.pickupPoints);
  const starts = startTime(tour.timing);
  const highlights = unique(tour.highlights.map(cleanText));
  const includes = unique(tour.includes.map(cleanText));
  const excludes = unique(tour.excludes.map(cleanText));
  // Highlights that only repeat the inclusions are not worth a second list.
  const sameAsIncluded = highlights.length > 0 && highlights.every((h) => includes.includes(h));

  const open = tour.departures.filter((d) => d.status === "SCHEDULED" && d.seatsLeft > 0);
  const price = tour.fromPrice ?? tour.guidePrice;
  const onRequest = open.length === 0;

  const facts: Array<{ icon: IconName; label: string; value: string }> = [
    {
      icon: "calendar",
      label: t("factDuration"),
      value: t("daysNights", { days: tour.durationDays, nights: tour.durationNights }),
    },
    ...(tour.tourType
      ? [{ icon: "heart" as const, label: t("factType"), value: tour.tourType }]
      : []),
    {
      icon: "users",
      label: t("factGroup"),
      value: t("upTo", { count: tour.groupSizeMax }),
    },
    { icon: "pin", label: t("factMeet"), value: cleanText(tour.meetingPoint) },
    ...(starts ? [{ icon: "clock" as const, label: t("factStarts"), value: starts }] : []),
    ...(transport.length > 0
      ? [
          {
            icon: "route" as const,
            label: t("factTransport"),
            value: transport.slice(0, 2).join(" · "),
          },
        ]
      : []),
  ];

  const sections = [
    { id: "overview", label: t("navOverview"), show: true },
    { id: "itinerary", label: t("navItinerary"), show: !!tour.itinerary },
    { id: "included", label: t("navIncluded"), show: includes.length + excludes.length > 0 },
    {
      id: "getting-there",
      label: t("navGettingThere"),
      show: places.places.length + places.notes.length + transport.length > 0,
    },
    {
      id: "policies",
      label: t("navPolicies"),
      show: policy.length > 0 || !!tour.cancellationPolicy,
    },
    { id: "good-to-know", label: t("navGoodToKnow"), show: tips.length + info.length > 0 },
  ].filter((s) => s.show);

  const related = (list.data?.items ?? [])
    .filter((x) => x.destination.slug === tour.destination.slug && x.slug !== tour.slug)
    .slice(0, 3);

  const galleryLabels = {
    title: t("photos", { name: tour.title }),
    open: t("openPhoto"),
    close: t("closePhotos"),
    previous: t("previousPhoto"),
    next: t("nextPhoto"),
    count: t.raw("photoCount") as string,
  };
  const own = tour.gallery.length > 0 ? tour.gallery : tour.hero ? [{ ...tour.hero }] : [];
  // Lead with a sharp photo: when the tour's own cover is low resolution
  // (old-website photos are 480 px), a licensed HD photo of the destination
  // takes the large tile and the tour's photos sit beside it.
  const destinationPhoto = photoFor(tour.slug, tour.destination.slug);
  const photos =
    own.length === 0 || isLowRes(own[0])
      ? [
          {
            url: destinationPhoto.src,
            alt: tour.destination.name,
            credit: null,
            width: destinationPhoto.width,
            height: destinationPhoto.height,
          },
          ...own,
        ]
      : own;
  const whatsapp = general?.whatsapp.replace(/[^\d]/g, "");
  const ask = encodeURIComponent(t("askMessage", { tour: tour.title }));
  const requestHref = `/contact?${new URLSearchParams({ topic: "package", about: tour.title })}`;

  return (
    <PageShell>
      <div className="grid gap-6 md:gap-8">
        <nav aria-label={t("breadcrumb")} className="text-[0.84rem] text-ink-2">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link href="/tours" className="font-semibold no-underline hover:text-ink">
                {t("allTours")}
              </Link>
            </li>
            <li aria-hidden>
              <Icon name="arrowRight" className="size-3.5 text-ink-3" />
            </li>
            <li>
              <Link
                href={`/tours?where=${tour.destination.slug}`}
                className="font-semibold no-underline hover:text-ink"
              >
                {tour.destination.name}
              </Link>
            </li>
            <li aria-hidden>
              <Icon name="arrowRight" className="size-3.5 text-ink-3" />
            </li>
            <li aria-current="page" className="line-clamp-1 text-ink-3">
              {title}
            </li>
          </ol>
        </nav>

        {/* Banner: the story on the left, photos on the right (photos first on phones). */}
        <section className="grid overflow-hidden rounded-card bg-night text-on-night lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          <div className="order-2 flex flex-col justify-between gap-7 p-6 md:p-10 lg:order-1">
            <div>
              <p className="flex flex-wrap gap-2">
                {tour.tourType && (
                  <span className="rounded-full bg-primary px-3 py-1 text-[0.72rem] font-bold uppercase tracking-[0.12em] text-on-primary">
                    {tour.tourType}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 rounded-full border border-white/25 px-3 py-1 text-[0.76rem] font-semibold">
                  <Icon name="pin" className="size-3.5" />
                  {tour.destination.name}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-white/25 px-3 py-1 text-[0.76rem] font-semibold">
                  <Icon name="calendar" className="size-3.5" />
                  {t("daysNights", { days: tour.durationDays, nights: tour.durationNights })}
                </span>
              </p>
              <h1 className="mt-4 font-display text-[clamp(2rem,4vw,3.25rem)] font-medium leading-[1.05]">
                {title}
              </h1>
              <p className="mt-4 line-clamp-5 max-w-[60ch] text-[1rem] leading-relaxed text-on-night-2">
                {summary}
              </p>
            </div>
            <div className="flex flex-wrap items-end justify-between gap-5 border-t border-white/15 pt-6">
              {price ? (
                <p>
                  <span className="block text-[0.8rem] text-on-night-2">
                    {tour.fromPrice ? t("fromPerAdult") : t("guidePrice")}
                  </span>
                  <span className="mt-1 flex flex-wrap items-baseline gap-x-2.5">
                    <span className="tabular font-display text-[2.2rem] font-medium leading-none">
                      {money(price)}
                    </span>
                    {!tour.fromPrice && tour.guideWasPrice && (
                      <span className="tabular text-[1rem] text-on-night-2 line-through">
                        {money(tour.guideWasPrice)}
                      </span>
                    )}
                  </span>
                </p>
              ) : (
                <p className="text-[0.9rem] text-on-night-2">{t("priceOnRequest")}</p>
              )}
              <div className="flex flex-wrap gap-2">
                <a href="#book" className={buttonClass("primary", "md", "no-underline")}>
                  {onRequest ? t("requestTour") : t("chooseDate")}
                </a>
                {tour.itinerary && (
                  <a
                    href="#itinerary"
                    className="inline-flex min-h-11 items-center rounded-control border border-white/30 px-4 text-[0.92rem] font-semibold text-on-night no-underline hover:bg-white/10"
                  >
                    {t("seeItinerary")}
                  </a>
                )}
              </div>
            </div>
          </div>
          <div className="order-1 p-2 md:p-3 lg:order-2 lg:min-h-[460px]">
            <TourPhotos
              photos={photos}
              fallback={destinationPhoto}
              labels={galleryLabels}
              countLabel={t("photoTotal", { count: photos.length })}
            />
          </div>
        </section>

        <ul
          aria-label={t("factsTitle")}
          className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6"
        >
          {facts.map((f) => (
            <li key={f.label} className="panel flex items-start gap-3 p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary-ink">
                <Icon name={f.icon} className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-[0.7rem] font-bold uppercase tracking-[0.1em] text-ink-3">
                  {f.label}
                </span>
                <span className="mt-0.5 block text-[0.9rem] font-semibold leading-snug text-ink">
                  {f.value}
                </span>
              </span>
            </li>
          ))}
        </ul>

        {/* In-page links; stays under the header while scrolling. */}
        <nav
          aria-label={t("onThisPage")}
          className="sticky top-[72px] z-30 -mx-4 overflow-x-auto border-y border-rule bg-paper/95 px-4 backdrop-blur md:mx-0 md:rounded-full md:border md:px-2"
        >
          <ul className="flex w-max gap-1 py-1.5">
            {sections.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="block whitespace-nowrap rounded-full px-3.5 py-2 text-[0.86rem] font-semibold text-ink-2 no-underline hover:bg-paper-2 hover:text-ink"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="grid content-start gap-5">
            <TourSection id="overview" icon="view" title={t("navOverview")}>
              <DescriptionBlocks blocks={blocks} />
              {overview.length > 0 && <DescriptionBlocks blocks={overview} />}
              {highlights.length > 0 && !sameAsIncluded && (
                <div className="grid gap-3">
                  <h3 className="text-[0.76rem] font-bold uppercase tracking-[0.12em] text-ink-3">
                    {t("highlights")}
                  </h3>
                  <CheckList items={highlights} tone="primary" columns={highlights.length > 3} />
                </div>
              )}
              {tour.tags.length > 0 && (
                <ul className="flex flex-wrap gap-1.5" aria-label={t("tags")}>
                  {tour.tags.map((tag) => (
                    <li
                      key={tag}
                      className="rounded-full bg-paper-2 px-2.5 py-1 text-[0.76rem] font-semibold text-ink-2"
                    >
                      #{tag}
                    </li>
                  ))}
                </ul>
              )}
            </TourSection>

            {tour.itinerary && (
              <TourSection id="itinerary" icon="route" title={t("itinerary")}>
                {days.days.length > 0 ? (
                  <ItineraryTimeline itinerary={days} dayLabel={t.raw("dayN") as string} />
                ) : (
                  <DescriptionBlocks blocks={describe(tour.itinerary)} />
                )}
              </TourSection>
            )}

            {includes.length + excludes.length > 0 && (
              <TourSection id="included" icon="check" title={t("whatsIncluded")}>
                <div
                  className={`grid gap-4 ${includes.length > 0 && excludes.length > 0 ? "md:grid-cols-2" : ""}`}
                >
                  {includes.length > 0 && (
                    <div className="rounded-[14px] border border-rule p-4 md:p-5">
                      <h3 className="mb-3 font-semibold text-good">{t("included")}</h3>
                      <CheckList
                        items={includes}
                        columns={excludes.length === 0 && includes.length > 5}
                      />
                    </div>
                  )}
                  {excludes.length > 0 && (
                    <div className="rounded-[14px] border border-rule bg-paper-2/40 p-4 md:p-5">
                      <h3 className="mb-3 font-semibold text-ink-2">{t("notIncluded")}</h3>
                      <CheckList items={excludes} tone="muted" />
                    </div>
                  )}
                </div>
              </TourSection>
            )}

            {places.places.length + places.notes.length + transport.length > 0 && (
              <TourSection id="getting-there" icon="car" title={t("navGettingThere")}>
                {places.places.length > 0 && (
                  <div className="grid gap-2.5">
                    <h3 className="text-[0.76rem] font-bold uppercase tracking-[0.12em] text-ink-3">
                      {t("pickupPoints")}
                    </h3>
                    <Chips items={places.places} icon="pin" />
                  </div>
                )}
                {places.notes.map((n) => (
                  <p
                    key={n}
                    className="flex items-start gap-2.5 rounded-[12px] bg-info-soft px-4 py-3 text-[0.9rem] text-ink"
                  >
                    <Icon name="clock" className="mt-0.5 size-4 shrink-0 text-info" />
                    {n}
                  </p>
                ))}
                {transport.length > 0 && (
                  <div className="grid gap-2.5">
                    <h3 className="text-[0.76rem] font-bold uppercase tracking-[0.12em] text-ink-3">
                      {t("transport")}
                    </h3>
                    <Chips items={transport} icon="route" />
                  </div>
                )}
                {tour.amenities.length > 0 && (
                  <div className="grid gap-2.5">
                    <h3 className="text-[0.76rem] font-bold uppercase tracking-[0.12em] text-ink-3">
                      {t("facilities")}
                    </h3>
                    <Chips items={tour.amenities.map((a) => a.name)} icon="check" />
                  </div>
                )}
              </TourSection>
            )}

            {(policy.length > 0 || tour.cancellationPolicy) && (
              <TourSection id="policies" icon="shield" title={t("navPolicies")}>
                {tour.cancellationPolicy && (
                  <p className="flex items-start gap-3 rounded-[12px] border-l-4 border-primary bg-primary-soft px-4 py-3 text-[0.93rem] text-ink">
                    <Icon name="refund" className="mt-0.5 size-5 shrink-0 text-primary-ink" />
                    <span>
                      <b className="block">{t("cancellationShort")}</b>
                      {cleanText(tour.cancellationPolicy)}
                    </span>
                  </p>
                )}
                {policy.length > 0 && (
                  <GroupList groups={policy} untitled={t("policy")} collapsible />
                )}
              </TourSection>
            )}

            {tips.length + info.length > 0 && (
              <TourSection id="good-to-know" icon="alert" title={t("navGoodToKnow")}>
                {tips.length > 0 && (
                  <div className="grid gap-3">
                    <h3 className="font-semibold text-ink">{t("travelTips")}</h3>
                    <GroupList groups={tips} untitled={t("travelTips")} />
                  </div>
                )}
                {info.length > 0 && (
                  <div className="grid gap-3 rounded-[14px] bg-warn-soft/60 p-4 md:p-5">
                    <h3 className="font-semibold text-ink">{t("moreInfo")}</h3>
                    <GroupList groups={info} untitled={t("moreInfo")} />
                  </div>
                )}
              </TourSection>
            )}
          </div>

          <aside
            id="book"
            className="grid scroll-mt-[150px] content-start gap-4 lg:sticky lg:top-[140px]"
          >
            {onRequest ? (
              <section className="panel overflow-hidden" aria-labelledby="request-h">
                <div className="border-b border-rule bg-paper-2/60 p-5 md:p-6">
                  <h2
                    id="request-h"
                    className="text-[0.78rem] font-bold uppercase tracking-[0.12em] text-ink-3"
                  >
                    {t("requestTitle")}
                  </h2>
                  {price ? (
                    <div className="mt-2">
                      <p className="text-[0.8rem] text-ink-3">{t("guidePrice")}</p>
                      <p className="flex flex-wrap items-baseline gap-x-2">
                        <span className="tabular font-display text-[2.1rem] font-medium leading-none">
                          {money(price)}
                        </span>
                        {tour.guideWasPrice && (
                          <span className="tabular text-[0.95rem] text-ink-3 line-through">
                            {money(tour.guideWasPrice)}
                          </span>
                        )}
                      </p>
                      <p className="mt-2 text-[0.8rem] text-ink-3">{t("guideNote")}</p>
                    </div>
                  ) : (
                    <p className="mt-2 text-[0.9rem] text-ink-2">{t("priceOnRequest")}</p>
                  )}
                </div>
                <div className="grid gap-3 p-5 md:p-6">
                  <p className="text-[0.9rem] text-ink-2">{t("requestIntro")}</p>
                  <Link
                    href={requestHref}
                    className={buttonClass("primary", "md", "w-full no-underline")}
                  >
                    {t("requestTour")}
                  </Link>
                  {whatsapp && (
                    <a
                      href={`https://wa.me/${whatsapp}?text=${ask}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={buttonClass("outline", "md", "w-full no-underline")}
                    >
                      <Icon name="chat" className="size-4" /> {t("askOnWhatsApp")}
                    </a>
                  )}
                  {general?.supportPhone && (
                    <a
                      href={`tel:${general.supportPhone.replace(/[^\d+]/g, "")}`}
                      className="text-center text-[0.86rem] font-semibold text-primary-ink"
                    >
                      {t("callUs", { phone: general.supportPhone })}
                    </a>
                  )}
                  <ol className="mt-2 grid gap-2.5 border-t border-rule pt-4 text-[0.84rem] text-ink-2">
                    {(["ask", "confirm", "pay"] as const).map((step, i) => (
                      <li key={step} className="flex items-start gap-2.5">
                        <span className="tabular grid size-6 shrink-0 place-items-center rounded-full bg-paper-2 text-[0.76rem] font-bold text-ink">
                          {i + 1}
                        </span>
                        <span className="pt-0.5">{t(`requestSteps.${step}`)}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </section>
            ) : (
              <DeparturePicker departures={tour.departures} isAgent={isAgent} />
            )}
            <PaymentNotice />
          </aside>
        </div>

        {related.length > 0 && (
          <section aria-labelledby="related-h" className="grid gap-4 pt-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 id="related-h" className="font-display text-[1.8rem] font-medium leading-tight">
                {t("moreIn", { name: tour.destination.name })}
              </h2>
              <Link
                href={`/tours?where=${tour.destination.slug}`}
                className="inline-flex items-center gap-1 text-[0.9rem] font-semibold text-primary-ink no-underline"
              >
                {t("seeAllIn", { name: tour.destination.name })}
                <Icon name="arrowRight" className="size-4" />
              </Link>
            </div>
            <ul className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {related.map((r) => (
                <li key={r.id}>
                  <TourCard tour={r} headingLevel={3} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* Phones: price and the booking button stay within reach. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-rule bg-card/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-[640px] items-center justify-between gap-3">
          <p className="min-w-0">
            <span className="block text-[0.72rem] text-ink-3">
              {price ? (tour.fromPrice ? t("fromPerAdult") : t("guidePrice")) : t("priceOnRequest")}
            </span>
            {price && (
              <span className="tabular font-display text-[1.3rem] font-medium leading-none">
                {money(price)}
              </span>
            )}
          </p>
          <a href="#book" className={buttonClass("primary", "md", "shrink-0 no-underline")}>
            {onRequest ? t("requestShort") : t("chooseDate")}
          </a>
        </div>
      </div>
      <div aria-hidden className="h-10 lg:hidden" />
    </PageShell>
  );
}
