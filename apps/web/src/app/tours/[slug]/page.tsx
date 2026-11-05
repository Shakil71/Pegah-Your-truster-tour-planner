import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@pegah/ui";
import { PageShell, PaymentNotice } from "@/components/shop/page-shell";
import { ensure, getPartner, serverApi } from "@/lib/api-server";
import { photoFor } from "@/lib/trip";
import { DeparturePicker } from "./departure-picker";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const api = await serverApi();
  const { data } = await api.GET("/api/v1/tours/{slug}", { params: { path: { slug } } });
  return { title: data?.title ?? "Tour" };
}

function List({ title, items, icon }: { title: string; items: string[]; icon: "check" | "x" }) {
  if (items.length === 0) return null;
  return (
    <section className="panel p-5 md:p-6">
      <h2 className="text-[1rem] font-semibold">{title}</h2>
      <ul className="mt-3 grid gap-2 text-[0.92rem]">
        {items.map((i) => (
          <li key={i} className="flex items-start gap-2">
            <Icon
              name={icon}
              className={`mt-0.5 size-4 shrink-0 ${icon === "check" ? "text-good" : "text-ink-3"}`}
            />
            {i}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function TourPage({ params }: Props) {
  const { slug } = await params;
  const api = await serverApi();
  const tour = ensure(await api.GET("/api/v1/tours/{slug}", { params: { path: { slug } } }));
  const isAgent = (await getPartner())?.user.partner?.kind === "AGENT";

  return (
    <PageShell>
      <div className="grid gap-8">
        <Link
          href={`/tours?where=${tour.destination.slug}`}
          className="inline-flex items-center gap-1 text-[0.86rem] font-semibold text-ink-2 no-underline hover:text-ink"
        >
          <Icon name="arrowLeft" className="size-4" /> Tours in {tour.destination.name}
        </Link>

        <section className="relative overflow-hidden rounded-card bg-night text-white">
          <Image
            src={photoFor(tour.slug, tour.destination.slug)}
            alt=""
            fill
            priority
            sizes="(min-width: 1280px) 1280px, 100vw"
            className="object-cover opacity-75"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_30%,rgb(10_12_28/0.85))]" />
          <div className="relative flex min-h-[340px] flex-col justify-end p-6 md:min-h-[420px] md:p-10">
            <p className="text-[0.86rem] text-white/80">
              {tour.destination.name} · {tour.durationDays} days, {tour.durationNights} nights · up
              to {tour.groupSizeMax} travellers
            </p>
            <h1 className="mt-1 font-display text-[clamp(2.2rem,4.4vw,3.6rem)] font-medium leading-[1.02]">
              {tour.title}
            </h1>
            <p className="mt-2 max-w-[60ch] text-white/85">{tour.summary}</p>
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div className="grid content-start gap-5">
            <section className="panel p-5 md:p-6">
              <h2 className="text-[1rem] font-semibold">The trip</h2>
              <p className="mt-2 whitespace-pre-line text-[0.95rem] text-ink-2">
                {tour.description}
              </p>
              <p className="mt-4 flex items-center gap-2 text-[0.9rem]">
                <Icon name="pin" className="size-4 text-primary-ink" /> Meet at {tour.meetingPoint}
              </p>
            </section>
            <List title="Highlights" items={tour.highlights} icon="check" />
            <div className="grid gap-5 md:grid-cols-2">
              <List title="Included" items={tour.includes} icon="check" />
              <List title="Not included" items={tour.excludes} icon="x" />
            </div>
          </div>
          <aside className="grid content-start gap-4 lg:sticky lg:top-[96px]">
            <DeparturePicker departures={tour.departures} isAgent={isAgent} />
            <PaymentNotice />
          </aside>
        </div>
      </div>
    </PageShell>
  );
}
