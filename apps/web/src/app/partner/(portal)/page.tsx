import Link from "next/link";
import { buttonClass } from "@pegah/ui";
import { ensure, serverApi } from "@/lib/api-server";
import { dhakaDateTime, money } from "@/lib/format";
import { DepartureControls } from "./departure-controls";

export default async function PartnerOverview() {
  const api = await serverApi();
  const o = ensure(await api.GET("/api/v1/partner/overview"));
  const session = ensure(await api.GET("/api/v1/partner/auth/session"));

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-primary-ink">
          {o.partner.name}
        </p>
        <h1 className="mt-1 font-display text-[clamp(1.9rem,3vw,2.5rem)] font-medium leading-tight">
          Overview
        </h1>
      </div>

      {o.agent && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ["Bookings, last 30 days", String(o.agent.bookings30d)],
              ["Commission earned", money(o.agent.commissionEarned)],
              ["Commission pending payment", money(o.agent.commissionPending)],
            ].map(([label, value]) => (
              <div key={label} className="panel p-4">
                <p className="text-[0.78rem] font-semibold text-ink-2">{label}</p>
                <p className="tabular mt-1 font-display text-[1.7rem] font-medium">{value}</p>
              </div>
            ))}
          </div>
          <section className="panel p-5 md:p-6">
            <h2 className="text-[1rem] font-semibold">Book for a client</h2>
            <p className="mt-1 text-[0.9rem] text-ink-2">
              Find a stay or tour, then choose <b>Book for a client</b> on its page. You earn{" "}
              {(o.partner.commissionBps / 100).toFixed(o.partner.commissionBps % 100 ? 2 : 0)}%
              commission on the total once the booking is confirmed. The client receives the booking
              emails.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/stays" className={buttonClass("primary", "md", "no-underline")}>
                Find stays
              </Link>
              <Link href="/tours" className={buttonClass("outline", "md", "no-underline")}>
                Find tours
              </Link>
            </div>
          </section>
        </>
      )}

      {o.supplier && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="panel p-4">
              <p className="text-[0.78rem] font-semibold text-ink-2">Upcoming reservations</p>
              <p className="tabular mt-1 font-display text-[1.7rem] font-medium">
                {o.supplier.upcomingReservations}
              </p>
              <Link
                href="/partner/reservations"
                className="text-[0.84rem] font-semibold text-primary-ink"
              >
                See reservations →
              </Link>
            </div>
            <div className="panel p-4">
              <p className="text-[0.78rem] font-semibold text-ink-2">
                Confirmed value, last 30 days
              </p>
              <p className="tabular mt-1 font-display text-[1.7rem] font-medium">
                {money(o.supplier.confirmedValue30d)}
              </p>
            </div>
          </div>

          {o.supplier.hotels.length === 0 && o.supplier.tours.length === 0 && (
            <p className="panel p-6 text-ink-2">
              No hotels or tours are assigned to you yet. The Pegah team will add them.
            </p>
          )}

          {o.supplier.hotels.map((h) => (
            <section key={h.slug} className="panel p-5 md:p-6">
              <h2 className="text-[1.05rem] font-semibold">{h.name}</h2>
              <p className="text-[0.8rem] text-ink-3">
                {h.status === "PUBLISHED" ? "Live on Pegah" : "Not live yet"}
              </p>
              <ul className="mt-3 grid gap-2">
                {h.rooms.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-rule px-4 py-3"
                  >
                    <span className={r.isActive ? "" : "text-ink-3"}>
                      {r.name}
                      {!r.isActive && " (not on sale)"}
                    </span>
                    <Link
                      href={`/partner/rooms/${r.id}`}
                      className={buttonClass("ink", "sm", "no-underline")}
                    >
                      Rooms and rates
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {o.supplier.tours.map((t) => (
            <section key={t.slug} className="panel p-5 md:p-6">
              <h2 className="text-[1.05rem] font-semibold">{t.title}</h2>
              <p className="text-[0.8rem] text-ink-3">Upcoming departures (Dhaka time)</p>
              {t.departures.length === 0 ? (
                <p className="mt-3 text-[0.9rem] text-ink-2">
                  No upcoming departures. Ask the Pegah team to add dates.
                </p>
              ) : (
                <ul className="mt-3 grid gap-2">
                  {t.departures.map((d) => (
                    <li
                      key={d.id}
                      className="grid gap-2 rounded-[12px] border border-rule px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto]"
                    >
                      <span>
                        <b>{dhakaDateTime(d.departsAt)}</b>
                        <span className="block text-[0.82rem] text-ink-2">
                          {d.sold} sold · {d.held} held · {d.capacity} seats · {money(d.priceAdult)}{" "}
                          adult
                        </span>
                      </span>
                      <DepartureControls departure={d} csrfToken={session.csrfToken} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </>
      )}
    </div>
  );
}
