import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Image from "next/image";
import Link from "next/link";
import { problemMessage } from "@pegah/api-client";
import { Icon, buttonClass } from "@pegah/ui";
import { PageShell, PaymentNotice } from "@/components/shop/page-shell";
import { StaySearchBar } from "@/components/shop/stay-search-bar";
import { ensure, getPartner, serverApi } from "@/lib/api-server";
import type { Locale } from "@/i18n/locales";
import { localName, money } from "@/lib/format";
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

/** Why a room cannot be booked, as a message key (API reason → text). */
const REASONS: Record<string, string> = {
  occupancy: "reasonOccupancy",
  "no-inventory": "reasonNotOnSale",
  "sold-out": "reasonSoldOut",
  "no-rate": "reasonNotOnSale",
  currency: "reasonUnavailable",
};

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
          <Image
            src={photoFor(hotel.slug, hotel.destination.slug)}
            alt=""
            fill
            priority
            sizes="(min-width: 1280px) 1280px, 100vw"
            className="object-cover opacity-75"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_30%,rgb(10_12_28/0.85))]" />
          <div className="relative flex min-h-[340px] flex-col justify-end p-6 md:min-h-[420px] md:p-10">
            <p className="text-[0.86rem] text-white/80">
              {hotel.starRating ? `${"★".repeat(hotel.starRating)} · ` : ""}
              {hotel.destination.name}
            </p>
            <h1 className="mt-1 font-display text-[clamp(2.2rem,4.4vw,3.6rem)] font-medium leading-[1.02]">
              {localName(locale, hotel.name, hotel.nameBn)}
            </h1>
            <p className="mt-2 max-w-[60ch] text-white/85">{hotel.summary}</p>
          </div>
        </section>

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
              <article
                key={r.room.id}
                className="panel grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_220px] md:p-6"
              >
                <div>
                  <h3 className="text-[1.15rem] font-semibold">{r.room.name}</h3>
                  <p className="mt-1 text-[0.9rem] text-ink-2">{r.room.description}</p>
                  <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[0.84rem] text-ink-2">
                    <span className="inline-flex items-center gap-1.5">
                      <Icon name="bed" className="size-4" /> {r.room.bedType}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Icon name="users" className="size-4" />{" "}
                      {t("occupancy", { adults: r.room.maxAdults, children: r.room.maxChildren })}
                    </span>
                    {r.room.sizeSqm && <span>{r.room.sizeSqm} m²</span>}
                  </p>
                </div>
                <div className="flex flex-col gap-1 md:items-end md:text-right">
                  {r.available && r.price ? (
                    <>
                      <p className="tabular font-display text-[1.7rem] font-medium leading-none">
                        {money(r.price.total)}
                      </p>
                      <p className="text-[0.76rem] text-ink-3">
                        {t("roomsInclTaxes", { rooms: stay.rooms })}
                      </p>
                      {r.roomsLeft !== null && r.roomsLeft <= 3 && (
                        <p className="text-[0.8rem] font-semibold text-warn">
                          {t("onlyLeft", { count: r.roomsLeft })}
                        </p>
                      )}
                      <Link
                        href={`/checkout?${stayQuery(stay, { product: "HOTEL", room: r.room.id })}`}
                        className={buttonClass("primary", "md", "mt-2 no-underline")}
                      >
                        {t("holdRoom")}
                      </Link>
                      {isAgent && (
                        <Link
                          href={`/checkout?${stayQuery(stay, { product: "HOTEL", room: r.room.id, as: "agent" })}`}
                          className={buttonClass("outline", "sm", "no-underline")}
                        >
                          {t("bookForClient")}
                        </Link>
                      )}
                    </>
                  ) : (
                    <p className="rounded-full bg-paper-2 px-3 py-1.5 text-[0.82rem] font-semibold text-ink-2">
                      {t(REASONS[r.reason ?? ""] ?? "reasonUnavailable")}
                    </p>
                  )}
                </div>
              </article>
            ))}
          </section>

          <aside className="grid content-start gap-4">
            <section className="panel p-5 md:p-6">
              <h2 className="text-[1rem] font-semibold">{t("about")}</h2>
              {hotel.description && (
                <p className="mt-2 whitespace-pre-line text-[0.92rem] text-ink-2">
                  {hotel.description}
                </p>
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
                  <dd className="mt-0.5">{hotel.addressLine}</dd>
                </div>
              </dl>
            </section>
            <section className="panel p-5 md:p-6">
              <h2 className="text-[1rem] font-semibold">{t("cancellationPolicy")}</h2>
              <p className="mt-2 text-[0.9rem] text-ink-2">{hotel.cancellationPolicy}</p>
            </section>
            <PaymentNotice />
          </aside>
        </div>
      </div>
    </PageShell>
  );
}
