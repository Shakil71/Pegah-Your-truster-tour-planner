import type { Metadata } from "next";
import Link from "next/link";
import { Icon, buttonClass, cx } from "@pegah/ui";
import { NoAccess } from "@/components/no-access";
import { PageHeader } from "@/components/page-header";
import { ensure, requireStaff, serverApi } from "@/lib/api-server";
import { dhakaToday } from "@/lib/dhaka-time";
import { money } from "@/lib/format";
import { CalendarEditor } from "./calendar-editor";

export const metadata: Metadata = { title: "Room calendar" };

const DAYS = 35;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const shift = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export default async function RoomCalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const session = await requireStaff();
  if (!session.user.permissions.includes("catalog:read")) {
    return <NoAccess what="the catalog" permission="catalog:read" />;
  }
  const today = dhakaToday().iso;
  const sp = await searchParams;
  const from = sp.from && ISO.test(sp.from) ? sp.from : today;
  const api = await serverApi();
  const cal = ensure(
    await api.GET("/api/v1/admin/rooms/{id}/calendar", {
      params: { path: { id }, query: { from, days: DAYS } },
    }),
  );
  const canEdit = session.user.permissions.includes("inventory:manage");
  const onSaleDays = cal.days.filter((d) => (d.total ?? 0) > 0 && d.rate);
  const committed = cal.days.reduce((a, d) => a + d.held + d.sold, 0);
  const capacity = cal.days.reduce((a, d) => a + (d.total ?? 0), 0);

  return (
    <div className="mx-auto grid max-w-[1300px] gap-6">
      <PageHeader
        eyebrow={`Inventory · ${cal.hotel.name}`}
        title={cal.room.name}
        intro="Rooms on sale and the nightly rate per date. Held = in someone's 15-minute checkout; sold = confirmed."
        back={{ href: `/catalog/hotels/${cal.hotel.slug}`, label: cal.hotel.name }}
        actions={
          <>
            <Link
              href={`/catalog/rooms/${id}?from=${shift(from, -DAYS)}`}
              className={buttonClass("outline", "sm")}
            >
              <Icon name="arrowLeft" className="size-4" /> Earlier
            </Link>
            <Link href={`/catalog/rooms/${id}`} className={buttonClass("ghost", "sm")}>
              Today
            </Link>
            <Link
              href={`/catalog/rooms/${id}?from=${shift(from, DAYS)}`}
              className={buttonClass("outline", "sm")}
            >
              Later <Icon name="arrowRight" className="size-4" />
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Nights bookable", `${onSaleDays.length} of ${DAYS}`],
          ["Room-nights held or sold", String(committed)],
          ["Occupancy in view", capacity ? `${Math.round((committed / capacity) * 100)}%` : "—"],
        ].map(([label, value]) => (
          <div key={label} className="panel p-4">
            <p className="text-[0.78rem] font-semibold text-ink-2">{label}</p>
            <p className="tabular mt-1 font-display text-[1.8rem] font-medium leading-none">
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <section className="panel p-4 md:p-5" aria-label="Calendar">
          <div className="grid grid-cols-7 gap-1.5 text-center text-[0.68rem] font-bold uppercase tracking-[0.08em] text-ink-3">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <ol className="mt-1.5 grid grid-cols-7 gap-1.5">
            {Array.from({ length: new Date(`${from}T00:00:00Z`).getUTCDay() }, (_, i) => (
              <li key={`pad-${i}`} aria-hidden="true" />
            ))}
            {cal.days.map((d) => {
              const date = new Date(`${d.date}T00:00:00Z`);
              const left = d.total === null ? null : d.total - d.held - d.sold;
              const past = d.date < today;
              const label = date.toLocaleDateString("en-GB", {
                timeZone: "UTC",
                day: "numeric",
                month: "short",
              });
              return (
                <li
                  key={d.date}
                  className={cx(
                    "min-h-[92px] rounded-[10px] border p-2 text-left text-[0.74rem]",
                    past && "opacity-45",
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
                    <p className="mt-1 text-ink-3">Not on sale</p>
                  ) : (
                    <>
                      <p className="tabular mt-1">
                        <b>{left}</b>
                        <span className="text-ink-3">/{d.total} free</span>
                      </p>
                      {(d.held > 0 || d.sold > 0) && (
                        <p className="tabular text-ink-3">
                          {d.held ? `${d.held} held` : ""}
                          {d.held && d.sold ? " · " : ""}
                          {d.sold ? `${d.sold} sold` : ""}
                        </p>
                      )}
                    </>
                  )}
                  <p
                    className={cx(
                      "tabular mt-1 font-semibold",
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
        {canEdit ? (
          <CalendarEditor
            roomId={id}
            from={from < today ? today : from}
            today={today}
            csrfToken={session.csrfToken}
          />
        ) : (
          <p className="panel p-5 text-[0.86rem] text-ink-2">
            Viewing only. Changing rooms on sale or rates needs <code>inventory:manage</code>.
          </p>
        )}
      </div>
    </div>
  );
}
