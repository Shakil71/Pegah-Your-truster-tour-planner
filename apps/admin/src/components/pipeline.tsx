import Link from "next/link";
import type { BookingStatus } from "@pegah/contracts";
import { StatusPill } from "./status-pill";

/** Where live bookings sit in the lifecycle. Bars are neutral; the pill carries state. */
export function Pipeline({ rows }: { rows: Array<{ status: BookingStatus; count: number }> }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  const attention = rows
    .filter((r) => ["MANUAL_REVIEW", "REFUND_PENDING", "CANCELLATION_REQUESTED"].includes(r.status))
    .reduce((a, r) => a + r.count, 0);
  return (
    <section
      className="panel animate-rise flex flex-col p-5 md:p-6"
      aria-labelledby="pipe-h"
      style={{ animationDelay: "300ms" }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="pipe-h" className="text-[0.95rem] font-semibold">
          Booking pipeline
        </h2>
        <Link
          href="/bookings"
          className="text-[0.8rem] font-semibold text-primary-ink hover:underline"
        >
          Open bookings
        </Link>
      </div>
      <p className="mt-1 text-[0.78rem] text-ink-3">
        Live bookings by state · {attention} need staff action
      </p>
      {rows.length === 0 && (
        <p className="mt-5 flex-1 text-[0.86rem] text-ink-2">No bookings yet.</p>
      )}
      <ul className="mt-5 grid flex-1 content-start gap-3.5">
        {rows.map((r) => (
          <li
            key={r.status}
            className="grid grid-cols-[140px_minmax(0,1fr)_36px] items-center gap-3"
          >
            <StatusPill status={r.status} className="justify-self-start" />
            <span className="h-2 overflow-hidden rounded-full bg-paper-2">
              <span
                className="block h-full rounded-full bg-ink/70"
                style={{ width: `${(r.count / max) * 100}%` }}
              />
            </span>
            <span className="tabular text-right text-[0.9rem] font-bold">{r.count}</span>
          </li>
        ))}
      </ul>
      <p className="mt-5 rounded-[12px] border border-dashed border-primary/60 bg-primary-soft px-3.5 py-2.5 text-[0.8rem] text-ink">
        Bookings move only through the server-side state machine. Manual changes are audit-logged.
      </p>
    </section>
  );
}
