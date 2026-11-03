import { taka } from "@pegah/shared";
import { Icon } from "@pegah/ui";
import type { Booking } from "@/data/sample";
import { StatusPill } from "./status-pill";

function ago(min: number) {
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  return h < 24 ? `${h} h ago` : `${Math.floor(h / 24)} d ago`;
}

export function BookingsTable({ rows, caption }: { rows: Booking[]; caption: string }) {
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
              Guest
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
              Amount
            </th>
            <th scope="col" className="px-2 py-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.ref} className="border-t border-rule transition-colors hover:bg-paper">
              <td className="px-4 py-3">
                <p className="tabular font-semibold">{b.ref}</p>
                <p className="text-[0.74rem] text-ink-3">
                  {ago(b.createdMinutesAgo)} · {b.channel}
                </p>
              </td>
              <td className="px-4 py-3">
                <span className="flex items-center gap-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary-soft text-[0.72rem] font-bold text-primary-ink">
                    {b.guest
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)}
                  </span>
                  {b.guest}
                </span>
              </td>
              <td className="px-4 py-3">
                <p className="max-w-[230px] truncate">{b.product}</p>
                <p className="text-[0.74rem] text-ink-3">{b.kind}</p>
              </td>
              <td className="tabular px-4 py-3">
                {b.checkIn}
                {b.kind === "Stay" && <span className="text-ink-3"> · {b.nights}n</span>}
              </td>
              <td className="px-4 py-3">
                <StatusPill status={b.status} />
              </td>
              <td className="tabular px-4 py-3 text-right font-semibold">{taka(b.amount)}</td>
              <td className="px-2 py-3">
                <button
                  type="button"
                  aria-label={`Actions for ${b.ref}`}
                  className="grid size-8 place-items-center rounded-full text-ink-3 hover:bg-paper-2 hover:text-ink"
                >
                  <Icon name="dots" className="size-5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
