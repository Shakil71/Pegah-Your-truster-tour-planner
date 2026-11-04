"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import type { Schemas } from "@pegah/api-client";
import { BOOKING_STATUSES, type BookingStatus } from "@pegah/contracts";
import { Icon, cx } from "@pegah/ui";
import { BookingsTable } from "@/components/bookings-table";
import { statusMeta } from "@/components/status-pill";

type Page = Schemas["BookingListResponseDto_Output"];

/** Filters live in the URL, so views can be shared and the server does the filtering. */
export function BookingsExplorer({ page }: { page: Page }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");
  const status = params.get("status") as BookingStatus | null;
  const kind = params.get("productType");
  // Scopes set by links from a customer, hotel or tour page.
  const scope = [
    params.get("customerId") && { key: "customerId", label: "One customer" },
    params.get("hotel") && { key: "hotel", label: `Hotel: ${params.get("hotel")}` },
    params.get("tour") && { key: "tour", label: `Tour: ${params.get("tour")}` },
  ].filter(Boolean) as { key: string; label: string }[];

  function go(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    next.delete("cursor");
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    startTransition(() => router.push(`${path}?${next.toString()}`));
  }

  const nextHref = page.nextCursor
    ? `${path}?${new URLSearchParams({ ...Object.fromEntries(params), cursor: page.nextCursor })}`
    : null;

  return (
    <section
      className={cx("panel animate-rise overflow-hidden", pending && "opacity-70")}
      aria-label="Bookings list"
      aria-busy={pending}
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-rule p-4 md:px-6">
        <form
          role="search"
          className="relative min-w-[220px] flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            go({ q: q.trim() || null });
          }}
        >
          <label htmlFor="booking-search" className="sr-only">
            Search by reference, guest name or email
          </label>
          <Icon
            name="search"
            className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-ink-3"
          />
          <input
            id="booking-search"
            type="search"
            value={q}
            maxLength={80}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Reference (PG-…), guest name or email — press Enter"
            className="h-11 w-full rounded-control border border-rule bg-paper pl-11 pr-4 text-[0.9rem] outline-none focus:border-ink"
          />
        </form>
        <div
          className="flex rounded-full border border-rule bg-paper p-1"
          role="group"
          aria-label="Product type"
        >
          {(
            [
              [null, "All"],
              ["HOTEL", "Stays"],
              ["TOUR", "Tours"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={label}
              type="button"
              aria-pressed={kind === value}
              onClick={() => go({ productType: value })}
              className={cx(
                "cursor-pointer rounded-full px-3.5 py-1.5 text-[0.8rem] font-semibold",
                kind === value ? "bg-ink text-card" : "text-ink-2 hover:text-ink",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {scope.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-rule bg-primary-soft/50 px-4 py-2.5 text-[0.8rem] md:px-6">
          <span className="font-semibold">Showing:</span>
          {scope.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => go({ [s.key]: null })}
              className="inline-flex items-center gap-1 rounded-full border border-primary bg-card px-2.5 py-1 font-semibold"
              aria-label={`Remove filter ${s.label}`}
            >
              {s.label} <Icon name="x" className="size-3.5" />
            </button>
          ))}
        </div>
      )}
      <div
        className="flex flex-wrap gap-2 border-b border-rule px-4 py-3 md:px-6"
        role="group"
        aria-label="Filter by status"
      >
        {[null, ...BOOKING_STATUSES.filter((s) => s !== "DRAFT")].map((s) => (
          <button
            key={s ?? "ALL"}
            type="button"
            aria-pressed={status === s}
            onClick={() => go({ status: s })}
            className={cx(
              "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-[0.78rem] font-semibold transition-colors",
              status === s
                ? "border-primary bg-primary text-on-primary"
                : "border-rule text-ink-2 hover:border-ink hover:text-ink",
            )}
          >
            {s === null ? "All" : statusMeta[s].label}
          </button>
        ))}
      </div>
      <BookingsTable rows={page.items} caption={`${page.items.length} bookings`} />
      <div className="flex items-center justify-between border-t border-rule px-4 py-3 text-[0.8rem] text-ink-2 md:px-6">
        <span>
          {page.items.length} booking{page.items.length === 1 ? "" : "s"} on this page
        </span>
        <span className="flex gap-4">
          {params.get("cursor") && (
            <Link href={path} className="font-semibold text-primary-ink hover:underline">
              First page
            </Link>
          )}
          {nextHref && (
            <Link href={nextHref} className="font-semibold text-primary-ink hover:underline">
              Older bookings →
            </Link>
          )}
        </span>
      </div>
    </section>
  );
}
