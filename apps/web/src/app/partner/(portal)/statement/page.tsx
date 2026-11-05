import type { Metadata } from "next";
import Link from "next/link";
import { BookingStatusBadge } from "@/components/shop/booking-status";
import { ensure, requirePartner, serverApi } from "@/lib/api-server";
import { dhakaDateTime, money } from "@/lib/format";
import { dhakaTodayIso } from "@/lib/trip";

export const metadata: Metadata = { title: "Statement" };

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const shiftMonth = (ym: string, n: number) => {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
};
const monthLabel = (ym: string) =>
  new Date(`${ym}-01T00:00:00Z`).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });

/** Monthly commission statement (Dhaka calendar month), for reconciliation with Pegah. */
export default async function StatementPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  await requirePartner("AGENT");
  const sp = await searchParams;
  const current = dhakaTodayIso().slice(0, 7);
  const month = sp.month && MONTH.test(sp.month) ? sp.month : current;
  const api = await serverApi();
  const s = ensure(await api.GET("/api/v1/partner/statement", { params: { query: { month } } }));

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-primary-ink">
            Commission statement
          </p>
          <h1 className="mt-1 font-display text-[clamp(1.9rem,3vw,2.5rem)] font-medium leading-tight">
            {monthLabel(s.month)}
          </h1>
        </div>
        <div className="flex gap-3 text-[0.9rem] font-semibold">
          <Link
            href={`/partner/statement?month=${shiftMonth(month, -1)}`}
            className="text-primary-ink"
          >
            ← Previous
          </Link>
          {month < current && (
            <Link
              href={`/partner/statement?month=${shiftMonth(month, 1)}`}
              className="text-primary-ink"
            >
              Next →
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Bookings made", String(s.totals.bookings)],
          ["Confirmed value", money(s.totals.confirmedValue)],
          ["Commission earned", money(s.totals.commissionEarned)],
        ].map(([label, value]) => (
          <div key={label} className="panel p-4">
            <p className="text-[0.78rem] font-semibold text-ink-2">{label}</p>
            <p className="tabular mt-1 font-display text-[1.7rem] font-medium">{value}</p>
          </div>
        ))}
      </div>

      {s.items.length === 0 ? (
        <p className="panel p-8 text-center text-ink-2">No bookings in this month.</p>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-[0.88rem]">
            <thead className="border-b border-rule text-[0.72rem] uppercase tracking-[0.08em] text-ink-3">
              <tr>
                <th className="px-4 py-3 font-semibold">Reference</th>
                <th className="px-4 py-3 font-semibold">What</th>
                <th className="px-4 py-3 font-semibold">Booked</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Total</th>
                <th className="px-4 py-3 text-right font-semibold">Commission</th>
              </tr>
            </thead>
            <tbody>
              {s.items.map((b) => (
                <tr key={b.id} className="border-b border-rule last:border-0">
                  <td className="tabular px-4 py-3">
                    <Link
                      href={`/partner/bookings/${b.id}`}
                      className="font-semibold text-primary-ink"
                    >
                      {b.reference}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{b.productName}</td>
                  <td className="tabular px-4 py-3">{dhakaDateTime(b.createdAt)}</td>
                  <td className="px-4 py-3">
                    <BookingStatusBadge
                      status={b.status as Parameters<typeof BookingStatusBadge>[0]["status"]}
                    />
                  </td>
                  <td className="tabular px-4 py-3 text-right">{money(b.total)}</td>
                  <td className="tabular px-4 py-3 text-right">{money(b.commission)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[0.8rem] text-ink-3">
        Months follow Bangladesh time. Commission counts only confirmed or completed bookings;
        cancelled and refunded bookings earn nothing. Payouts are settled with the Pegah team.
      </p>
    </div>
  );
}
