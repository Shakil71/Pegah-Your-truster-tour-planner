import Link from "next/link";
import { Icon, buttonClass } from "@pegah/ui";
import { ActivityFeed } from "@/components/activity-feed";
import { BookingsTable } from "@/components/bookings-table";
import { Departures } from "@/components/departures";
import { KpiCard } from "@/components/kpi-card";
import { OccupancyHeatmap } from "@/components/occupancy-heatmap";
import { Pipeline } from "@/components/pipeline";
import { RevenueChart } from "@/components/revenue-chart";
import {
  activity,
  bookings,
  departures,
  kpis,
  occupancyGrid,
  pipeline,
  properties,
  revenueDaily,
} from "@/data/sample";
import { dhakaToday, greeting, nextDays } from "@/lib/dhaka-time";

export default function DashboardPage() {
  const today = dhakaToday();
  const days = nextDays(today.local, 14);
  const grid = occupancyGrid(today.dow);
  const needAction = pipeline
    .filter((p) => ["MANUAL_REVIEW", "REFUND_PENDING", "CANCELLATION_REQUESTED"].includes(p.status))
    .reduce((a, p) => a + p.count, 0);

  return (
    <div className="mx-auto grid max-w-[1440px] gap-6">
      {/* Greeting band */}
      <section className="animate-rise relative overflow-hidden rounded-card bg-night px-6 py-7 text-white md:px-8">
        <div
          aria-hidden="true"
          className="absolute -right-24 -top-24 size-[340px] rounded-full bg-[radial-gradient(circle,rgb(255_133_47/0.45),transparent_65%)]"
        />
        <div aria-hidden="true" className="absolute bottom-0 left-0 right-0 stitch opacity-70" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-primary">
              Operations overview
            </p>
            <h1 className="mt-2 font-display text-[clamp(1.9rem,3.4vw,2.8rem)] font-medium leading-[1.05]">
              {greeting(today.hour)}, Shakil.
            </h1>
            <p className="mt-2 max-w-[56ch] text-white/75">
              <b className="text-white">{needAction} bookings</b> need staff action and{" "}
              <b className="text-white">2 departures</b> leave in the next 48 hours.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Link href="/bookings" className={buttonClass("primary", "md")}>
              <Icon name="ticket" className="size-[18px]" />
              Review bookings
            </Link>
            <button type="button" className={buttonClass("onPhoto", "md")}>
              <Icon name="download" className="size-[18px]" />
              Export
            </button>
          </div>
        </div>
      </section>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k, i) => (
          <KpiCard
            key={k.key}
            index={i}
            label={k.label}
            value={k.value}
            format={k.format}
            delta={k.delta}
            spark={k.spark}
            hint={k.hint}
            invert={k.invert}
          />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <RevenueChart daily={revenueDaily} endDate={today.iso} />
        <Pipeline rows={pipeline} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <OccupancyHeatmap properties={properties} grid={grid} days={days} />
        <Departures items={departures} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section
          className="panel animate-rise overflow-hidden"
          aria-labelledby="recent-h"
          style={{ animationDelay: "480ms" }}
        >
          <div className="flex items-center justify-between px-5 pt-5 md:px-6">
            <div>
              <h2 id="recent-h" className="text-[0.95rem] font-semibold">
                Recent bookings
              </h2>
              <p className="mt-1 text-[0.78rem] text-ink-3">Newest first</p>
            </div>
            <Link
              href="/bookings"
              className="inline-flex items-center gap-1 text-[0.8rem] font-semibold text-primary-ink hover:underline"
            >
              View all <Icon name="arrowRight" className="size-4" />
            </Link>
          </div>
          <div className="mt-3">
            <BookingsTable rows={bookings.slice(0, 7)} caption="Seven most recent bookings" />
          </div>
        </section>
        <ActivityFeed items={activity} />
      </div>

      <p className="text-center text-[0.74rem] text-ink-3">
        All figures are sample data for design review. No live bookings or payments are shown.
      </p>
    </div>
  );
}
