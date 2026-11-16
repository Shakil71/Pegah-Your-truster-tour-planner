import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { PageShell, PaymentNotice } from "@/components/shop/page-shell";
import { TourCard } from "@/components/shop/tour-card";
import { ensure, serverApi } from "@/lib/api-server";
import { matchDestination } from "@/lib/trip";

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
                <TourCard tour={tour} />
              </li>
            ))}
          </ul>
        )}
        <PaymentNotice />
      </div>
    </PageShell>
  );
}
