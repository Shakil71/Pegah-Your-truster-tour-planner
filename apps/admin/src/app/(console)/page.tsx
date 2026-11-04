import Link from "next/link";
import type { Schemas } from "@pegah/api-client";
import { Icon, buttonClass, type IconName } from "@pegah/ui";
import { ActivityFeed } from "@/components/activity-feed";
import { BookingsTable } from "@/components/bookings-table";
import { Departures } from "@/components/departures";
import { KpiCard } from "@/components/kpi-card";
import { OccupancyHeatmap } from "@/components/occupancy-heatmap";
import { Pipeline } from "@/components/pipeline";
import { RevenueChart } from "@/components/revenue-chart";
import { ensure, requireStaff, serverApi } from "@/lib/api-server";
import { timeAgo } from "@/lib/format";
import { dhakaToday, greeting } from "@/lib/dhaka-time";

type Summary = Schemas["DashboardSummaryDto_Output"];

/** Percent change; null when the previous period was empty (no meaningful baseline). */
function delta(now: number, before: number): number | null {
  return before > 0 ? ((now - before) / before) * 100 : null;
}

const ACTIVITY: Record<
  string,
  { icon: IconName; tone: "good" | "info" | "warn" | "neutral"; verb: string }
> = {
  "booking.created": { icon: "ticket", tone: "info", verb: "Booking held" },
  "booking.status_changed": { icon: "check", tone: "good", verb: "Booking status changed" },
  "auth.staff_login.succeeded": { icon: "key", tone: "neutral", verb: "Staff signed in" },
  "auth.staff_login.failed": { icon: "alert", tone: "warn", verb: "Failed staff sign-in" },
  "user.staff_created": { icon: "users", tone: "good", verb: "Staff account created (CLI)" },
  "user.role_granted": { icon: "key", tone: "neutral", verb: "Role granted (CLI)" },
  "staff.created": { icon: "users", tone: "good", verb: "Staff account created" },
  "staff.updated": { icon: "key", tone: "neutral", verb: "Staff access changed" },
};

function activityItems(summary: Summary) {
  return summary.recentActivity.map((a) => {
    const meta = ACTIVITY[a.action] ?? {
      icon: "log" as const,
      tone: "neutral" as const,
      verb: a.action,
    };
    const who = a.actorName ?? (a.actorType === "SYSTEM" ? "System" : a.actorType.toLowerCase());
    return {
      key: `${a.at}-${a.action}-${a.targetId ?? ""}`,
      icon: meta.icon,
      tone: meta.tone,
      text: `${meta.verb} · ${who}`,
      ago: timeAgo(a.at),
    };
  });
}

export default async function DashboardPage() {
  const session = await requireStaff();
  const api = await serverApi();
  const summary = ensure(await api.GET("/api/v1/admin/dashboard"));
  const today = dhakaToday();
  const k = summary.kpis;
  const dailyValue = summary.daily.map((d) =>
    Math.round((d.confirmed.amountMinor + d.pending.amountMinor) / 100),
  );
  const dailyCount = summary.daily.map((d) => d.bookings);
  const departingSoon = summary.departures.filter(
    (d) => Date.parse(d.departsAt) - Date.parse(summary.generatedAt) < 48 * 3_600_000,
  ).length;
  const firstName = session.user.fullName.split(" ")[0];
  const dayLabels = summary.occupancy.days.map((iso) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
      timeZone: "UTC",
      weekday: "short",
      day: "numeric",
    }),
  );

  return (
    <div className="mx-auto grid max-w-[1440px] gap-6">
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
              {greeting(today.hour)}, {firstName}.
            </h1>
            <p className="mt-2 max-w-[60ch] text-white/75">
              <b className="text-white">{k.needsAction} bookings</b> need staff action,{" "}
              <b className="text-white">{k.pendingPayment}</b> are holding inventory while awaiting
              payment, and <b className="text-white">{departingSoon} departures</b> leave in the
              next 48 hours.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Link href="/bookings" className={buttonClass("primary", "md")}>
              <Icon name="ticket" className="size-[18px]" />
              Review bookings
            </Link>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          index={0}
          label="Confirmed value"
          value={Math.round(k.confirmedValue30d.amountMinor / 100)}
          format="money"
          delta={delta(k.confirmedValue30d.amountMinor, k.confirmedValuePrev30d.amountMinor)}
          spark={summary.daily.slice(-14).map((d) => d.confirmed.amountMinor)}
          hint="Last 30 days"
        />
        <KpiCard
          index={1}
          label="Bookings created"
          value={k.bookings30d}
          format="count"
          delta={delta(k.bookings30d, k.bookingsPrev30d)}
          spark={dailyCount.slice(-14)}
          hint="Last 30 days"
        />
        <KpiCard
          index={2}
          label="Occupancy"
          value={k.occupancyNext14d}
          format="percent"
          delta={null}
          spark={summary.occupancy.days.map((_, i) => {
            const vals = summary.occupancy.hotels
              .map((h) => h.values[i])
              .filter((v): v is number => v !== null);
            return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
          })}
          hint="Next 14 nights, sold or held"
        />
        <KpiCard
          index={3}
          label="Awaiting payment"
          value={k.pendingPayment}
          format="count"
          delta={null}
          spark={dailyCount.slice(-14)}
          hint="Inventory held, expires if unpaid"
          invert
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <RevenueChart daily={dailyValue} endDate={summary.today} />
        <Pipeline rows={summary.statusCounts} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {summary.occupancy.hotels.length > 0 ? (
          <OccupancyHeatmap
            properties={summary.occupancy.hotels.map((h) => h.name)}
            grid={summary.occupancy.hotels.map((h) => h.values)}
            days={dayLabels}
          />
        ) : (
          <section className="panel grid place-items-center p-10 text-center text-ink-2">
            No hotel inventory is on sale for the next 14 nights.
          </section>
        )}
        <Departures items={summary.departures} />
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
            <BookingsTable rows={summary.recentBookings} caption="Most recent bookings" />
          </div>
        </section>
        <ActivityFeed items={activityItems(summary)} />
      </div>

      <p className="text-center text-[0.74rem] text-ink-3">
        Live figures from the Pegah database, generated {timeAgo(summary.generatedAt)}. Confirmed
        value counts only CONFIRMED and COMPLETED bookings.
      </p>
    </div>
  );
}
