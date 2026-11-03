"use client";

import { useMemo, useState } from "react";
import { taka } from "@pegah/shared";
import { Icon, cx } from "@pegah/ui";
import { BookingsTable } from "@/components/bookings-table";
import { statusMeta } from "@/components/status-pill";
import type { Booking, BookingStatus } from "@/data/sample";

type Filter = "ALL" | BookingStatus;

export function BookingsExplorer({ rows }: { rows: Booking[] }) {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"All" | Booking["kind"]>("All");

  const counts = useMemo(() => {
    const c = new Map<BookingStatus, number>();
    rows.forEach((r) => c.set(r.status, (c.get(r.status) ?? 0) + 1));
    return c;
  }, [rows]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (filter === "ALL" || r.status === filter) &&
        (kind === "All" || r.kind === kind) &&
        (!needle || `${r.ref} ${r.guest} ${r.product}`.toLowerCase().includes(needle)),
    );
  }, [rows, filter, q, kind]);

  const total = shown.reduce((a, r) => a + r.amount, 0);
  const chips: Filter[] = [
    "ALL",
    ...(Object.keys(statusMeta) as BookingStatus[]).filter((s) => counts.has(s)),
  ];

  return (
    <section className="panel animate-rise overflow-hidden" aria-label="Bookings list">
      <div className="flex flex-wrap items-center gap-3 border-b border-rule p-4 md:px-6">
        <label className="relative min-w-[220px] flex-1">
          <span className="sr-only">Search by reference, guest or product</span>
          <Icon
            name="search"
            className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-ink-3"
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Reference, guest or product"
            className="h-11 w-full rounded-control border border-rule bg-paper pl-11 pr-4 text-[0.9rem] outline-none focus:border-ink"
          />
        </label>
        <div
          className="flex rounded-full border border-rule bg-paper p-1"
          role="group"
          aria-label="Product type"
        >
          {(["All", "Stay", "Tour"] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
              className={cx(
                "cursor-pointer rounded-full px-3.5 py-1.5 text-[0.8rem] font-semibold",
                kind === k ? "bg-ink text-card" : "text-ink-2 hover:text-ink",
              )}
            >
              {k}
            </button>
          ))}
        </div>
      </div>
      <div
        className="flex flex-wrap gap-2 border-b border-rule px-4 py-3 md:px-6"
        role="group"
        aria-label="Filter by status"
      >
        {chips.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={filter === s}
            onClick={() => setFilter(s)}
            className={cx(
              "tabular inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-[0.78rem] font-semibold transition-colors",
              filter === s
                ? "border-primary bg-primary text-on-primary"
                : "border-rule text-ink-2 hover:border-ink hover:text-ink",
            )}
          >
            {s === "ALL" ? "All" : statusMeta[s].label}
            <span className="opacity-70">{s === "ALL" ? rows.length : counts.get(s)}</span>
          </button>
        ))}
      </div>
      {shown.length ? (
        <BookingsTable rows={shown} caption={`${shown.length} bookings`} />
      ) : (
        <div className="grid place-items-center gap-2 px-6 py-16 text-center">
          <Icon name="search" className="size-8 text-ink-3" />
          <p className="font-semibold">No bookings match these filters</p>
          <button
            type="button"
            onClick={() => {
              setFilter("ALL");
              setQ("");
              setKind("All");
            }}
            className="text-[0.86rem] font-semibold text-primary-ink hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}
      <div className="tabular flex justify-between border-t border-rule px-4 py-3 text-[0.8rem] text-ink-2 md:px-6">
        <span>
          {shown.length} of {rows.length} bookings
        </span>
        <span>Total {taka(total)}</span>
      </div>
    </section>
  );
}
