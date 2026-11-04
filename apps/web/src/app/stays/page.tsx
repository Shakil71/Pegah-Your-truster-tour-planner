import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { problemMessage } from "@pegah/api-client";
import { Icon } from "@pegah/ui";
import { PageShell, PaymentNotice } from "@/components/shop/page-shell";
import { StaySearchBar } from "@/components/shop/stay-search-bar";
import { ensure, serverApi } from "@/lib/api-server";
import { money } from "@/lib/format";
import { matchDestination, nightsOf, parseStayParams, photoFor, stayQuery } from "@/lib/trip";

export const metadata: Metadata = { title: "Stays" };
export const dynamic = "force-dynamic";

type Search = Record<string, string | undefined>;

export default async function StaysPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const params = parseStayParams(sp);
  const api = await serverApi();
  const { items: destinations } = ensure(await api.GET("/api/v1/destinations"));
  const withHotels = destinations.filter((d) => d.hotelCount > 0);
  const destination = matchDestination(sp.where, withHotels) ?? withHotels[0];
  const nights = nightsOf(params);

  if (!destination) {
    return (
      <PageShell>
        <h1 className="font-display text-[2.4rem] font-medium">Stays</h1>
        <p className="mt-4 text-ink-2">No stays are on sale yet. Please check back soon.</p>
      </PageShell>
    );
  }

  const search = await api.GET("/api/v1/hotels/search", {
    params: { query: { destination: destination.slug, ...params } },
  });
  const unknownWhere = sp.where && !matchDestination(sp.where, withHotels);

  return (
    <PageShell>
      <div className="grid gap-6">
        <div>
          <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-primary-ink">
            Stays in {destination.region}
          </p>
          <h1 className="mt-1.5 font-display text-[clamp(2rem,3.6vw,3rem)] font-medium leading-tight">
            {destination.name}
          </h1>
          <p className="mt-1 max-w-[70ch] text-ink-2">{destination.summary}</p>
        </div>

        <StaySearchBar
          where={destination.slug}
          params={params}
          destinations={withHotels.map((d) => ({ slug: d.slug, name: d.name }))}
        />

        {unknownWhere && (
          <p className="rounded-[12px] bg-warn-soft px-4 py-3 text-[0.9rem] text-warn">
            We do not have stays in “{sp.where}” yet, so here is {destination.name}.
          </p>
        )}

        {!search.data ? (
          <p role="alert" className="rounded-[12px] bg-critical-soft px-4 py-3 text-critical">
            {problemMessage(search.error as unknown, "Search failed. Please try again.")}
          </p>
        ) : search.data.offers.length === 0 ? (
          <section className="panel px-6 py-14 text-center">
            <Icon name="bed" className="mx-auto size-9 text-ink-3" />
            <h2 className="mt-3 font-display text-[1.6rem] font-medium">
              Nothing free on these dates
            </h2>
            <p className="mt-1 text-ink-2">Try other dates, fewer rooms, or another destination.</p>
          </section>
        ) : (
          <>
            <p className="text-[0.9rem] text-ink-2">
              {search.data.offers.length} propert{search.data.offers.length === 1 ? "y" : "ies"} ·{" "}
              {nights} night{nights === 1 ? "" : "s"} · {params.adults} adult
              {params.adults === 1 ? "" : "s"}
              {params.children
                ? ` · ${params.children} child${params.children === 1 ? "" : "ren"}`
                : ""}{" "}
              · prices include service charge and VAT
            </p>
            <ul className="grid gap-5">
              {search.data.offers.map((o) => (
                <li key={o.hotel.id}>
                  <article className="panel group relative grid overflow-hidden md:grid-cols-[320px_minmax(0,1fr)_240px]">
                    <div className="relative aspect-[4/3] md:aspect-auto md:min-h-[220px]">
                      <Image
                        src={photoFor(o.hotel.slug, destination.slug)}
                        alt=""
                        fill
                        sizes="(min-width: 768px) 320px, 100vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    </div>
                    <div className="p-5 md:p-6">
                      <p className="text-[0.78rem] text-ink-3">
                        {o.hotel.starRating ? `${"★".repeat(o.hotel.starRating)} · ` : ""}
                        {o.hotel.destination.name}
                      </p>
                      <h2 className="mt-1 font-display text-[1.6rem] font-medium leading-tight">
                        <Link
                          href={`/stays/${o.hotel.slug}?${stayQuery(params)}`}
                          className="no-underline after:absolute after:inset-0 hover:underline"
                        >
                          {o.hotel.name}
                        </Link>
                      </h2>
                      <p className="mt-2 line-clamp-2 text-[0.92rem] text-ink-2">
                        {o.hotel.summary}
                      </p>
                      <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[0.84rem]">
                        <span className="inline-flex items-center gap-1.5">
                          <Icon name="bed" className="size-4 text-primary-ink" />
                          {o.room.name} · {o.room.bedType}
                        </span>
                        {o.roomsLeft <= 3 && (
                          <span className="font-semibold text-warn">
                            Only {o.roomsLeft} left on these dates
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex flex-col justify-end gap-1 border-t border-rule p-5 md:border-l md:border-t-0 md:p-6 md:text-right">
                      <p className="text-[0.78rem] text-ink-3">
                        {params.rooms} room{params.rooms === 1 ? "" : "s"} · {nights} night
                        {nights === 1 ? "" : "s"}
                      </p>
                      <p className="tabular font-display text-[1.9rem] font-medium leading-none">
                        {money(o.price.total)}
                      </p>
                      <p className="text-[0.78rem] text-ink-3">
                        from {money(o.price.perNightFrom)} per room per night
                      </p>
                      <span className="mt-3 inline-flex items-center gap-1 self-start rounded-full bg-primary px-4 py-2 text-[0.86rem] font-semibold text-on-primary md:self-end">
                        See rooms <Icon name="arrowRight" className="size-4" />
                      </span>
                    </div>
                  </article>
                </li>
              ))}
            </ul>
            <p className="text-[0.78rem] text-ink-3">
              Prices were checked{" "}
              {new Date(search.data.pricedAt).toLocaleTimeString("en-GB", {
                timeZone: "Asia/Dhaka",
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              Dhaka time and are confirmed again when you hold a room.
            </p>
          </>
        )}
        <PaymentNotice />
      </div>
    </PageShell>
  );
}
