import type { Metadata } from "next";
import { buttonClass } from "@pegah/ui";
import { NoAccess } from "@/components/no-access";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { ensure, requireStaff, serverApi } from "@/lib/api-server";
import { dhakaToday } from "@/lib/dhaka-time";
import { calendarDate, money } from "@/lib/format";

export const metadata: Metadata = { title: "Reports" };

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const shift = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const session = await requireStaff();
  if (!session.user.permissions.includes("report:read")) {
    return <NoAccess what="reports" permission="report:read" />;
  }
  const today = dhakaToday().iso;
  const sp = await searchParams;
  const to = sp.to && ISO.test(sp.to) ? sp.to : today;
  const from = sp.from && ISO.test(sp.from) ? sp.from : shift(to, -29);
  const api = await serverApi();
  const r = ensure(
    await api.GET("/api/v1/admin/reports/sales", { params: { query: { from, to } } }),
  );
  const t = r.totals;

  return (
    <div className="mx-auto grid max-w-[1440px] gap-6">
      <PageHeader
        eyebrow="Growth"
        title="Sales report"
        intro="Bookings created in the period (Dhaka calendar). Revenue counts confirmed and completed bookings only; refunds are those paid in the period."
      />
      <form className="panel flex flex-wrap items-end gap-3 p-4 md:px-6" action="/admin/reports">
        <label className="grid gap-1 text-[0.84rem] font-semibold">
          From
          <input
            type="date"
            name="from"
            defaultValue={from}
            max={today}
            className="h-11 rounded-control border border-rule px-3"
          />
        </label>
        <label className="grid gap-1 text-[0.84rem] font-semibold">
          To
          <input
            type="date"
            name="to"
            defaultValue={to}
            max={today}
            className="h-11 rounded-control border border-rule px-3"
          />
        </label>
        <button type="submit" className={buttonClass("ink", "md")}>
          Show
        </button>
        <a
          href={`/api/v1/admin/reports/bookings.csv?from=${from}&to=${to}`}
          className={buttonClass("outline", "md", "ml-auto")}
        >
          Download bookings CSV
        </a>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Bookings", String(t.bookings)],
          ["Confirmed", String(t.confirmedBookings)],
          ["Confirmed value", money(t.confirmedValue)],
          ["Refunds paid", money(t.refunded)],
          ["Net revenue", money(t.netRevenue)],
        ].map(([label, value]) => (
          <div key={label} className="panel p-4">
            <p className="text-[0.78rem] font-semibold text-ink-2">{label}</p>
            <p className="tabular mt-1 font-display text-[1.6rem] font-medium leading-tight">
              {value}
            </p>
          </div>
        ))}
      </div>
      {t.discounts.amountMinor > 0 && (
        <p className="text-[0.84rem] text-ink-2">
          Promotion discounts on confirmed bookings: {money(t.discounts)}.
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="panel overflow-hidden" aria-labelledby="prod-h">
          <h2 id="prod-h" className="px-5 pt-5 text-[0.95rem] font-semibold md:px-6">
            By product
          </h2>
          <table className="mt-3 w-full text-left text-[0.86rem]">
            <thead>
              <tr className="text-[0.7rem] uppercase tracking-[0.08em] text-ink-3">
                <th scope="col" className="px-5 py-2 font-semibold md:px-6">
                  Product
                </th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">
                  Bookings
                </th>
                <th scope="col" className="px-5 py-2 text-right font-semibold md:px-6">
                  Confirmed value
                </th>
              </tr>
            </thead>
            <tbody>
              {r.byProduct.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-ink-2">
                    No bookings in this period.
                  </td>
                </tr>
              )}
              {r.byProduct.map((p) => (
                <tr key={`${p.type}-${p.name}`} className="border-t border-rule">
                  <td className="px-5 py-2.5 md:px-6">
                    {p.name}
                    <span className="ml-1 text-[0.74rem] text-ink-3">
                      {p.type === "HOTEL" ? "stay" : "tour"}
                    </span>
                  </td>
                  <td className="tabular px-3 py-2.5 text-right">{p.bookings}</td>
                  <td className="tabular px-5 py-2.5 text-right font-semibold md:px-6">
                    {money(p.confirmedValue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="panel p-5 md:p-6" aria-labelledby="st-h">
          <h2 id="st-h" className="text-[0.95rem] font-semibold">
            By status
          </h2>
          <ul className="mt-4 grid gap-2.5">
            {r.byStatus.map((s) => (
              <li key={s.status} className="flex items-center justify-between gap-3">
                <StatusPill status={s.status} />
                <span className="tabular font-bold">{s.count}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="panel overflow-hidden" aria-labelledby="day-h">
        <h2 id="day-h" className="px-5 pt-5 text-[0.95rem] font-semibold md:px-6">
          By day
        </h2>
        {/* Focusable so keyboard users can scroll the table (WCAG 2.1.1). */}
        <div
          className="mt-3 max-h-[420px] overflow-y-auto focus-visible:outline-2"
          tabIndex={0}
          role="region"
          aria-labelledby="day-h"
        >
          <table className="w-full text-left text-[0.84rem]">
            <thead className="sticky top-0 bg-card">
              <tr className="text-[0.7rem] uppercase tracking-[0.08em] text-ink-3">
                <th scope="col" className="px-5 py-2 font-semibold md:px-6">
                  Date
                </th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">
                  Bookings
                </th>
                <th scope="col" className="px-5 py-2 text-right font-semibold md:px-6">
                  Confirmed value
                </th>
              </tr>
            </thead>
            <tbody>
              {[...r.byDay].reverse().map((d) => (
                <tr key={d.date} className="border-t border-rule">
                  <td className="tabular px-5 py-2 md:px-6">{calendarDate(d.date)}</td>
                  <td className="tabular px-3 py-2 text-right">{d.bookings}</td>
                  <td className="tabular px-5 py-2 text-right md:px-6">
                    {money(d.confirmedValue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
