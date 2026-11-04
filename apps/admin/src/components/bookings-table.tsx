import Link from "next/link";
import type { Schemas } from "@pegah/api-client";
import { Icon } from "@pegah/ui";
import { calendarDate, money, timeAgo } from "@/lib/format";
import { StatusPill } from "./status-pill";

type Row = Schemas["BookingSummary_Output"];

function nights(start: string, end: string | null): number | null {
  if (!end) return null;
  return Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000);
}

export function BookingsTable({ rows, caption }: { rows: Row[]; caption: string }) {
  if (rows.length === 0) {
    return (
      <p className="px-6 py-14 text-center text-ink-2">
        No bookings yet. They appear here the moment a customer holds a room or seat.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-left text-[0.86rem]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="text-[0.7rem] uppercase tracking-[0.08em] text-ink-3">
            <th scope="col" className="px-4 py-3 font-semibold">
              Booking
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Lead guest
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Product
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Travel
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Status
            </th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">
              Total
            </th>
            <th scope="col" className="px-2 py-3">
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => {
            const n = nights(b.startDate, b.endDate);
            return (
              <tr key={b.id} className="border-t border-rule transition-colors hover:bg-paper">
                <td className="px-4 py-3">
                  <Link
                    href={`/bookings/${b.id}`}
                    className="tabular font-semibold hover:underline"
                  >
                    {b.reference}
                  </Link>
                  <p className="text-[0.74rem] text-ink-3">{timeAgo(b.createdAt)}</p>
                </td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-2.5">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary-soft text-[0.72rem] font-bold text-primary-ink">
                      {b.contactName
                        .split(" ")
                        .map((p) => p[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </span>
                    {b.contactName}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <p className="max-w-[230px] truncate">{b.productName}</p>
                  <p className="text-[0.74rem] text-ink-3">
                    {b.productType === "HOTEL" ? "Stay" : "Tour"} · {b.guests} guest
                    {b.guests === 1 ? "" : "s"}
                  </p>
                </td>
                <td className="tabular px-4 py-3">
                  {calendarDate(b.startDate)}
                  {b.productType === "HOTEL" && n !== null && (
                    <span className="text-ink-3"> · {n}n</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusPill status={b.status} />
                </td>
                <td className="tabular px-4 py-3 text-right font-semibold">{money(b.total)}</td>
                <td className="px-2 py-3">
                  <Link
                    href={`/bookings/${b.id}`}
                    aria-label={`Open ${b.reference}`}
                    className="grid size-8 place-items-center rounded-full text-ink-3 hover:bg-paper-2 hover:text-ink"
                  >
                    <Icon name="arrowRight" className="size-4" />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
