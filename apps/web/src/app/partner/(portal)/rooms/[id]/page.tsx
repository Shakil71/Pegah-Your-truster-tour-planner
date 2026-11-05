import type { Metadata } from "next";
import Link from "next/link";
import { Icon, buttonClass, cx } from "@pegah/ui";
import { ensure, requirePartner, serverApi } from "@/lib/api-server";
import { money } from "@/lib/format";
import { dhakaTodayIso } from "@/lib/trip";
import { CalendarEditor } from "./calendar-editor";

export const metadata: Metadata = { title: "Rooms and rates" };

const DAYS = 35;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const shift = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Supplier view of one room type: rooms on sale and nightly rates. The API checks ownership. */
export default async function PartnerRoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const session = await requirePartner("SUPPLIER");
  const today = dhakaTodayIso();
  const sp = await searchParams;
  const from = sp.from && ISO.test(sp.from) ? sp.from : today;
  const api = await serverApi();
  const cal = ensure(
    await api.GET("/api/v1/partner/rooms/{id}/calendar", {
      params: { path: { id }, query: { from, days: DAYS } },
    }),
  );
  const committed = cal.days.reduce((a, d) => a + d.held + d.sold, 0);
  const capacity = cal.days.reduce((a, d) => a + (d.total ?? 0), 0);

  return (
    <div className="grid gap-6">
      <Link
        href="/partner"
        className="inline-flex items-center gap-1 text-[0.86rem] font-semibold text-ink-2 no-underline hover:text-ink"
      >
        <Icon name="arrowLeft" className="size-4" /> Overview
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-primary-ink">
            {cal.hotel.name}
          </p>
          <h1 className="mt-1 font-display text-[clamp(1.9rem,3vw,2.5rem)] font-medium leading-tight">
            {cal.room.name}
          </h1>
          <p className="mt-1 max-w-[70ch] text-[0.9rem] text-ink-2">
            Rooms on sale and the nightly rate per date. Held means a guest is in the 15-minute
            checkout; sold means confirmed.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/partner/rooms/${id}?from=${shift(from, -DAYS)}`}
            className={buttonClass("outline", "sm", "no-underline")}
          >
            <Icon name="arrowLeft" className="size-4" /> Earlier
          </Link>
          <Link
            href={`/partner/rooms/${id}`}
            className={buttonClass("ghost", "sm", "no-underline")}
          >
            Today
          </Link>
          <Link
            href={`/partner/rooms/${id}?from=${shift(from, DAYS)}`}
            className={buttonClass("outline", "sm", "no-underline")}
          >
            Later <Icon name="arrowRight" className="size-4" />
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="panel p-4">
          <p className="text-[0.78rem] font-semibold text-ink-2">Room-nights held or sold</p>
          <p className="tabular mt-1 font-display text-[1.7rem] font-medium">{committed}</p>
        </div>
        <div className="panel p-4">
          <p className="text-[0.78rem] font-semibold text-ink-2">Occupancy in view</p>
          <p className="tabular mt-1 font-display text-[1.7rem] font-medium">
            {capacity ? `${Math.round((committed / capacity) * 100)}%` : "—"}
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <section className="panel p-3 md:p-5" aria-label="Calendar">
          <div className="grid grid-cols-7 gap-1 text-center text-[0.66rem] font-bold uppercase tracking-[0.08em] text-ink-3 md:gap-1.5">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <ol className="mt-1.5 grid grid-cols-7 gap-1 md:gap-1.5">
            {Array.from({ length: new Date(`${from}T00:00:00Z`).getUTCDay() }, (_, i) => (
              <li key={`pad-${i}`} aria-hidden="true" />
            ))}
            {cal.days.map((d) => {
              const left = d.total === null ? null : d.total - d.held - d.sold;
              const label = new Date(`${d.date}T00:00:00Z`).toLocaleDateString("en-GB", {
                timeZone: "UTC",
                day: "numeric",
                month: "short",
              });
              return (
                <li
                  key={d.date}
                  className={cx(
                    "min-h-[80px] min-w-0 rounded-[10px] border p-1.5 text-left text-[0.66rem] md:p-2 md:text-[0.74rem]",
                    d.date < today && "opacity-45",
                    d.total === null || !d.rate
                      ? "border-dashed border-rule bg-paper"
                      : left === 0
                        ? "border-ink/30 bg-paper-2"
                        : "border-rule bg-card",
                  )}
                  aria-label={`${label}: ${d.total === null ? "not on sale" : `${left} of ${d.total} free, ${d.held} held, ${d.sold} sold`}${d.rate ? `, ${money(d.rate)}` : ", no rate"}`}
                >
                  <p className="font-bold">{label}</p>
                  {d.total === null ? (
                    <p className="mt-1 text-ink-3">Off</p>
                  ) : (
                    <p className="tabular mt-1">
                      <b>{left}</b>
                      <span className="text-ink-3">/{d.total}</span>
                    </p>
                  )}
                  <p
                    className={cx(
                      "tabular mt-1 truncate font-semibold",
                      d.rate ? "text-primary-ink" : "text-critical",
                    )}
                  >
                    {d.rate ? money(d.rate) : "No rate"}
                  </p>
                </li>
              );
            })}
          </ol>
        </section>
        <CalendarEditor
          roomId={id}
          from={from < today ? today : from}
          today={today}
          csrfToken={session.csrfToken}
        />
      </div>
    </div>
  );
}
