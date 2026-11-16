import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { problemMessage } from "@pegah/api-client";
import { Icon } from "@pegah/ui";
import { PageShell, PaymentNotice } from "@/components/shop/page-shell";
import { HeroPhoto } from "@/components/shop/hero-photo";
import { PhotoGallery } from "@/components/shop/photo-gallery";
import { RoomCard } from "@/components/shop/room-card";
import { TextBlocks } from "@/components/shop/text-blocks";
import { StaySearchBar } from "@/components/shop/stay-search-bar";
import { ensure, getPartner, serverApi } from "@/lib/api-server";
import type { Locale } from "@/i18n/locales";
import { isLowRes } from "@/lib/media";
import { localName } from "@/lib/format";
import { cleanText } from "@/lib/text";
import { nightsOf, parseStayParams, photoFor, stayQuery } from "@/lib/trip";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const api = await serverApi();
  const { data } = await api.GET("/api/v1/hotels/{slug}", { params: { path: { slug } } });
  return { title: data?.name ?? (await getTranslations("property"))("fallbackTitle") };
}

export default async function HotelPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const t = await getTranslations("property");
  const locale = (await getLocale()) as Locale;
  const stay = parseStayParams(await searchParams);
  const api = await serverApi();
  const hotel = ensure(await api.GET("/api/v1/hotels/{slug}", { params: { path: { slug } } }));
  const isAgent = (await getPartner())?.user.partner?.kind === "AGENT";
  const offers = await api.GET("/api/v1/hotels/{slug}/offers", {
    params: { path: { slug }, query: stay },
  });
  const nights = nightsOf(stay);
  const roomInfo = new Map(hotel.rooms.map((r) => [r.id, r]));
  const general = (await api.GET("/api/v1/site")).data?.general;
  const contact = general ? { whatsapp: general.whatsapp, phone: general.supportPhone } : null;
  const galleryLabels = {
    title: t("photos", { name: hotel.name }),
    open: t("openPhoto"),
    close: t("closePhotos"),
    previous: t("previousPhoto"),
    next: t("nextPhoto"),
    count: t("photoCount"),
  };
  const groups = new Map<string, string[]>();
  for (const a of hotel.amenities) {
    const g = a.group ?? t("otherFacilities");
    groups.set(g, [...(groups.get(g) ?? []), cleanText(a.name)]);
  }
  const policies: Array<[string, string | null]> = [
    [t("childPolicy"), hotel.childPolicy],
    [t("petPolicy"), hotel.petPolicy],
    [t("breakfast"), hotel.breakfast],
    [t("houseRules"), hotel.houseRules],
    [t("specialNote"), hotel.specialNote],
  ];

  return (
    <PageShell>
      <div className="grid gap-8">
        <div>
          <Link
            href={`/stays?${stayQuery(stay, { where: hotel.destination.slug })}`}
            className="inline-flex items-center gap-1 text-[0.86rem] font-semibold text-ink-2 no-underline hover:text-ink"
          >
            <Icon name="arrowLeft" className="size-4" />{" "}
            {t("backTo", { name: hotel.destination.name })}
          </Link>
        </div>

        <section className="relative overflow-hidden rounded-card bg-night text-white">
          <HeroPhoto media={hotel.hero} fallback={photoFor(hotel.slug, hotel.destination.slug)} />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_30%,rgb(10_12_28/0.85))]" />
          <div
            className={`relative flex min-h-[340px] flex-col justify-end p-6 md:min-h-[420px] md:p-10 ${isLowRes(hotel.hero) ? "md:max-w-[56%]" : ""}`}
          >
            <p className="text-[0.86rem] text-white/80">
              {hotel.starRating ? `${"★".repeat(hotel.starRating)} · ` : ""}
              {hotel.destination.name}
            </p>
            <h1 className="mt-1 font-display text-[clamp(2.2rem,4.4vw,3.6rem)] font-medium leading-[1.02]">
              {localName(locale, hotel.name, hotel.nameBn)}
            </h1>
            <p className="mt-2 max-w-[60ch] text-white/85">{cleanText(hotel.summary)}</p>
          </div>
        </section>

        {hotel.gallery.length > 1 && <PhotoGallery photos={hotel.gallery} labels={galleryLabels} />}

        <StaySearchBar
          where={hotel.destination.slug}
          params={stay}
          destinations={[]}
          action={`/stays/${hotel.slug}`}
        />

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <section aria-labelledby="rooms-h" className="grid content-start gap-4">
            <h2 id="rooms-h" className="font-display text-[1.8rem] font-medium">
              {t("roomsFor", { nights })}
            </h2>
            {!offers.data && (
              <p role="alert" className="rounded-[12px] bg-critical-soft px-4 py-3 text-critical">
                {problemMessage(offers.error as unknown, t("pricesFailed"))}
              </p>
            )}
            {offers.data?.rooms.map((r) => (
              <RoomCard
                key={r.room.id}
                offer={r}
                info={roomInfo.get(r.room.id)}
                hotelName={hotel.name}
                stay={stay}
                isAgent={isAgent}
                contact={contact}
              />
            ))}
          </section>

          <aside className="grid content-start gap-4">
            <section className="panel p-5 md:p-6">
              <h2 className="text-[1rem] font-semibold">{t("about")}</h2>
              {hotel.description && (
                <TextBlocks
                  text={cleanText(hotel.description)}
                  className="mt-2 grid gap-3 text-[0.92rem] text-ink-2"
                />
              )}
              <dl className="mt-4 grid gap-3 text-[0.9rem]">
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-2">{t("checkInFrom")}</dt>
                  <dd className="tabular font-semibold">{hotel.checkInTime}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-2">{t("checkOutBy")}</dt>
                  <dd className="tabular font-semibold">{hotel.checkOutTime}</dd>
                </div>
                <div>
                  <dt className="text-ink-2">{t("address")}</dt>
                  <dd className="mt-0.5">{cleanText(hotel.addressLine)}</dd>
                </div>
                {hotel.distanceFromCity && (
                  <div>
                    <dt className="text-ink-2">{t("distanceCity")}</dt>
                    <dd className="mt-0.5">{cleanText(hotel.distanceFromCity)}</dd>
                  </div>
                )}
                {hotel.distanceFromSpot && (
                  <div>
                    <dt className="text-ink-2">{t("distanceSpot")}</dt>
                    <dd className="mt-0.5">{cleanText(hotel.distanceFromSpot)}</dd>
                  </div>
                )}
              </dl>
              {hotel.nearbyPlaces.length > 0 && (
                <>
                  <h3 className="mt-4 text-[0.9rem] font-semibold">{t("nearby")}</h3>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {hotel.nearbyPlaces.map((p) => (
                      <li
                        key={p}
                        className="inline-flex items-center gap-1 rounded-full bg-paper-2 px-2.5 py-1 text-[0.78rem] text-ink-2"
                      >
                        <Icon name="pin" className="size-3.5" /> {cleanText(p)}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
            {groups.size > 0 && (
              <section className="panel p-5 md:p-6" aria-labelledby="fac-h">
                <h2 id="fac-h" className="text-[1rem] font-semibold">
                  {t("facilities")}
                </h2>
                <div className="mt-3 grid gap-3">
                  {[...groups].map(([g, names]) => (
                    <div key={g}>
                      <h3 className="text-[0.8rem] font-semibold uppercase tracking-[0.06em] text-ink-3">
                        {g}
                      </h3>
                      <ul className="mt-1.5 grid gap-1 text-[0.88rem] text-ink-2 sm:grid-cols-2">
                        {names.map((n) => (
                          <li key={n} className="flex items-start gap-1.5">
                            <Icon name="check" className="mt-0.5 size-4 shrink-0 text-good" /> {n}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {policies.some(([, v]) => v) && (
              <section className="panel p-5 md:p-6" aria-labelledby="pol-h">
                <h2 id="pol-h" className="text-[1rem] font-semibold">
                  {t("policies")}
                </h2>
                <dl className="mt-3 grid gap-3 text-[0.9rem]">
                  {policies
                    .filter(([, v]) => v)
                    .map(([label, value]) => (
                      <div key={label}>
                        <dt className="font-semibold">{label}</dt>
                        <dd className="mt-1">
                          <TextBlocks text={cleanText(value)} className="grid gap-2 text-ink-2" />
                        </dd>
                      </div>
                    ))}
                </dl>
              </section>
            )}
            <section className="panel p-5 md:p-6">
              <h2 className="text-[1rem] font-semibold">{t("cancellationPolicy")}</h2>
              <p className="mt-2 text-[0.9rem] text-ink-2">{cleanText(hotel.cancellationPolicy)}</p>
            </section>
            <PaymentNotice />
          </aside>
        </div>
      </div>
    </PageShell>
  );
}
