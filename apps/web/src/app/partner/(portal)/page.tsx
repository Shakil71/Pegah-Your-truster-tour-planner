import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { buttonClass } from "@pegah/ui";
import type { Locale } from "@/i18n/locales";
import { ensure, serverApi } from "@/lib/api-server";
import { dhakaDateTime, money } from "@/lib/format";
import { DepartureControls } from "./departure-controls";

export default async function PartnerOverview() {
  const t = await getTranslations("partner");
  const locale = (await getLocale()) as Locale;
  const api = await serverApi();
  const o = ensure(await api.GET("/api/v1/partner/overview"));
  const session = ensure(await api.GET("/api/v1/partner/auth/session"));
  const pct = (o.partner.commissionBps / 100).toFixed(o.partner.commissionBps % 100 ? 2 : 0);

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-primary-ink">
          {o.partner.name}
        </p>
        <h1 className="mt-1 font-display text-[clamp(1.9rem,3vw,2.5rem)] font-medium leading-tight">
          {t("nav.overview")}
        </h1>
      </div>

      {o.agent && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              [t("overview.bookings30d"), String(o.agent.bookings30d)],
              [t("overview.earned"), money(o.agent.commissionEarned)],
              [t("overview.pending"), money(o.agent.commissionPending)],
            ].map(([label, value]) => (
              <div key={label} className="panel p-4">
                <p className="text-[0.78rem] font-semibold text-ink-2">{label}</p>
                <p className="tabular mt-1 font-display text-[1.7rem] font-medium">{value}</p>
              </div>
            ))}
          </div>
          <section className="panel p-5 md:p-6">
            <h2 className="text-[1rem] font-semibold">{t("overview.bookTitle")}</h2>
            <p className="mt-1 text-[0.9rem] text-ink-2">
              {t.rich("overview.bookIntro", { pct, b: (c) => <b>{c}</b> })}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/stays" className={buttonClass("primary", "md", "no-underline")}>
                {t("nav.findStays")}
              </Link>
              <Link href="/tours" className={buttonClass("outline", "md", "no-underline")}>
                {t("nav.findTours")}
              </Link>
            </div>
          </section>
        </>
      )}

      {o.supplier && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="panel p-4">
              <p className="text-[0.78rem] font-semibold text-ink-2">{t("overview.upcoming")}</p>
              <p className="tabular mt-1 font-display text-[1.7rem] font-medium">
                {o.supplier.upcomingReservations}
              </p>
              <Link
                href="/partner/reservations"
                className="text-[0.84rem] font-semibold text-primary-ink"
              >
                {t("overview.seeReservations")}
              </Link>
            </div>
            <div className="panel p-4">
              <p className="text-[0.78rem] font-semibold text-ink-2">
                {t("overview.confirmed30d")}
              </p>
              <p className="tabular mt-1 font-display text-[1.7rem] font-medium">
                {money(o.supplier.confirmedValue30d)}
              </p>
            </div>
          </div>

          {o.supplier.hotels.length === 0 && o.supplier.tours.length === 0 && (
            <p className="panel p-6 text-ink-2">{t("overview.nothingAssigned")}</p>
          )}

          {o.supplier.hotels.map((h) => (
            <section key={h.slug} className="panel p-5 md:p-6">
              <h2 className="text-[1.05rem] font-semibold">{h.name}</h2>
              <p className="text-[0.8rem] text-ink-3">
                {h.status === "PUBLISHED" ? t("overview.live") : t("overview.notLive")}
              </p>
              <ul className="mt-3 grid gap-2">
                {h.rooms.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-rule px-4 py-3"
                  >
                    <span className={r.isActive ? "" : "text-ink-3"}>
                      {r.name}
                      {!r.isActive && ` ${t("overview.notOnSale")}`}
                    </span>
                    <Link
                      href={`/partner/rooms/${r.id}`}
                      className={buttonClass("ink", "sm", "no-underline")}
                    >
                      {t("overview.roomsRates")}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {o.supplier.tours.map((tour) => (
            <section key={tour.slug} className="panel p-5 md:p-6">
              <h2 className="text-[1.05rem] font-semibold">{tour.title}</h2>
              <p className="text-[0.8rem] text-ink-3">{t("overview.departures")}</p>
              {tour.departures.length === 0 ? (
                <p className="mt-3 text-[0.9rem] text-ink-2">{t("overview.noDepartures")}</p>
              ) : (
                <ul className="mt-3 grid gap-2">
                  {tour.departures.map((d) => (
                    <li
                      key={d.id}
                      className="grid gap-2 rounded-[12px] border border-rule px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto]"
                    >
                      <span>
                        <b>{dhakaDateTime(d.departsAt, locale)}</b>
                        <span className="block text-[0.82rem] text-ink-2">
                          {t("overview.departureLine", {
                            sold: d.sold,
                            held: d.held,
                            capacity: d.capacity,
                            price: money(d.priceAdult),
                          })}
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
