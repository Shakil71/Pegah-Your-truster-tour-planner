import Link from "next/link";
import type { Schemas } from "@pegah/api-client";
import { BookingStatusBadge } from "@/components/shop/booking-status";
import { calendarDate, money } from "@/lib/format";

type Row = Schemas["PartnerBookingListDto_Output"]["items"][number];

/** Bookings table shared by supplier reservations and agent client bookings. */
export function PartnerBookingTable({
  items,
  showCommission,
  linkTo,
}: {
  items: Row[];
  showCommission: boolean;
  linkTo?: (id: string) => string;
}) {
  if (items.length === 0) {
    return <p className="panel p-8 text-center text-ink-2">Nothing here yet.</p>;
  }
  return (
    <div className="panel overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-[0.88rem]">
        <thead className="border-b border-rule text-[0.72rem] uppercase tracking-[0.08em] text-ink-3">
          <tr>
            <th className="px-4 py-3 font-semibold">Reference</th>
            <th className="px-4 py-3 font-semibold">Guest</th>
            <th className="px-4 py-3 font-semibold">What</th>
            <th className="px-4 py-3 font-semibold">Dates</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3 text-right font-semibold">Total</th>
            {showCommission && <th className="px-4 py-3 text-right font-semibold">Commission</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((b) => (
            <tr key={b.id} className="border-b border-rule last:border-0">
              <td className="tabular px-4 py-3">
                {linkTo ? (
                  <Link href={linkTo(b.id)} className="font-semibold text-primary-ink">
                    {b.reference}
                  </Link>
                ) : (
                  b.reference
                )}
              </td>
              <td className="px-4 py-3">
                {b.contactName}
                <span className="block text-[0.76rem] text-ink-3">
                  {b.guests} guest{b.guests === 1 ? "" : "s"}
                </span>
              </td>
              <td className="px-4 py-3">{b.productName}</td>
              <td className="tabular px-4 py-3">
                {calendarDate(b.startDate)}
                {b.endDate ? ` – ${calendarDate(b.endDate)}` : ""}
              </td>
              <td className="px-4 py-3">
                <BookingStatusBadge status={b.status} />
              </td>
              <td className="tabular px-4 py-3 text-right">{money(b.total)}</td>
              {showCommission && (
                <td className="tabular px-4 py-3 text-right">{money(b.commission)}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
