import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@pegah/ui";
import { PageShell, PaymentNotice } from "@/components/shop/page-shell";
import { ensure, serverApi } from "@/lib/api-server";
import type { Locale } from "@/i18n/locales";
import { localName } from "@/lib/format";
import { matchDestination, photoFor } from "@/lib/trip";
import { cleanText } from "@/lib/text";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("hotels");
  return { title: t("title"), description: t("intro") };
}
export const dynamic = "force-dynamic";

/**
 * Every published hotel, grouped by destination, with no dates needed: a
 * browsing page. Opening a hotel shows its rooms; dates, prices and
 * availability are chosen and checked there (the server prices every stay).
 */
export default async function HotelsPage({
  searchParams,
}: {
  searchParams: Promise<{ where?: string }>;
}) {
  const { where } = await searchParams;
  const t = await getTranslations("hotels");
  const locale = (await getLocale()) as Locale;
  const api = await serverApi();

  const { items } = ensure(await api.GET("/api/v1/destinations"));
  const places = items.filter((d) => d.hotelCount > 0).sort((a, b) => b.hotelCount - a.hotelCount);
  const place = matchDestination(where, places);
  const chosen = place ? [place] : places;

  const groups = (
    await Promise.all(
      chosen.map(async (d) => {
        const { data } = await api.GET("/api/v1/destinations/{slug}", {
          params: { path: { slug: d.slug } },
        });
        return data ? { destination: d, hotels: data.hotels } : null;
      }),
    )
  ).filter((g) => g !== null && g.hotels.length > 0);
  const total = groups.reduce((n, g) => n + (g?.hotels.length ?? 0), 0);

  return (
    <PageShell>
      <div className="grid gap-8">
        <div>
          <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-primary-ink">
            {t("eyebrow")}
          </p>
          <h1 className="mt-1.5 font-display text-[clamp(2rem,3.6vw,3rem)] font-medium leading-tight">
            {place
              ? t("inPlace", { name: localName(locale, place.name, place.nameBn) })
              : t("title")}
          </h1>
          <p className="mt-1 max-w-[70ch] text-ink-2">{t("intro")}</p>
          <p className="mt-2 text-[0.86rem] text-ink-3">{t("count", { count: total })}</p>
        </div>

        <nav aria-label={t("filter")} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <Link
            href="/hotels"
            aria-current={!place ? "page" : undefined}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[0.84rem] font-semibold no-underline ${!place ? "border-primary bg-primary text-on-primary" : "border-rule text-ink-2 hover:border-ink"}`}
          >
            {t("all")}
          </Link>
          {places.map((p) => (
            <Link
              key={p.slug}
              href={`/hotels?where=${p.slug}`}
              aria-current={place?.slug === p.slug ? "page" : undefined}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[0.84rem] font-semibold no-underline ${place?.slug === p.slug ? "border-primary bg-primary text-on-primary" : "border-rule text-ink-2 hover:border-ink"}`}
            >
              {localName(locale, p.name, p.nameBn)}{" "}
              <span className="font-normal opacity-75">{p.hotelCount}</span>
            </Link>
          ))}
        </nav>

        {where && !place && (
          <p className="rounded-[12px] bg-warn-soft px-4 py-3 text-[0.9rem] text-warn">
            {t("unknownWhere", { where })}
          </p>
        )}

        {groups.length === 0 ? (
          <p className="panel px-6 py-14 text-center text-ink-2">{t("none")}</p>
        ) : (
          groups.map((g) =>
            g ? (
              <section key={g.destination.slug} aria-labelledby={`h-${g.destination.slug}`}>
                <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-rule pb-2">
                  <h2
                    id={`h-${g.destination.slug}`}
                    className="font-display text-[1.6rem] font-medium leading-tight"
                  >
                    {localName(locale, g.destination.name, g.destination.nameBn)}
                  </h2>
                  <p className="text-[0.84rem] text-ink-3">
                    {g.destination.region} · {t("count", { count: g.hotels.length })}
                  </p>
                </div>
                {/* Four columns on wide screens keep the old 480 px photos close to their real size. */}
                <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {g.hotels.map((h) => (
                    <li key={h.id}>
                      <article className="panel group relative flex h-full flex-col overflow-hidden">
                        <div className="relative aspect-[4/3] overflow-hidden bg-paper-2">
                          <Image
                            src={h.hero?.url ?? photoFor(h.slug, h.destination.slug)}
                            alt={h.hero?.alt ?? ""}
                            fill
                            unoptimized={!!h.hero}
                            sizes="(min-width: 1280px) 300px, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                          />
                          {h.starRating ? (
                            <span className="absolute left-3 top-3 rounded-full bg-card/95 px-2.5 py-1 text-[0.74rem] font-semibold text-ink">
                              {t("stars", { count: h.starRating })}
                            </span>
                          ) : null}
                        </div>
                        <div className="flex flex-1 flex-col p-4">
                          <p className="flex items-center gap-1 text-[0.78rem] text-ink-3">
                            <Icon name="pin" className="size-3.5" />
                            {localName(locale, h.destination.name, null)}
                          </p>
                          <h3 className="mt-1 text-[1.08rem] font-semibold leading-snug">
                            <Link
                              href={`/stays/${h.slug}`}
                              className="no-underline after:absolute after:inset-0 hover:underline"
                            >
                              {localName(locale, h.name, h.nameBn)}
                            </Link>
                          </h3>
                          <p className="mt-1.5 line-clamp-2 flex-1 text-[0.86rem] text-ink-2">
                            {cleanText(h.summary)}
                          </p>
                          <span className="mt-3 inline-flex items-center gap-1 text-[0.86rem] font-semibold text-primary-ink">
                            {t("view")} <Icon name="arrowRight" className="size-4" />
                          </span>
                        </div>
                      </article>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null,
          )
        )}
        <PaymentNotice />
      </div>
    </PageShell>
  );
}
