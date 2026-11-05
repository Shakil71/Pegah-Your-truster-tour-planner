"use client";

import Link from "next/link";
import { useState } from "react";
import type { Schemas } from "@pegah/api-client";
import { buttonClass, cx } from "@pegah/ui";
import { dhakaDateTime, money } from "@/lib/format";

type Departure = Schemas["TourDeparture_Output"];

/** Choose a departure and party size; the checkout asks the API for the exact price. */
export function DeparturePicker({
  departures,
  isAgent = false,
}: {
  departures: Departure[];
  isAgent?: boolean;
}) {
  const open = departures.filter((d) => d.status === "SCHEDULED" && d.seatsLeft > 0);
  const [id, setId] = useState(open[0]?.id ?? "");
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const chosen = open.find((d) => d.id === id);
  const party = adults + children;
  const fits = chosen ? party <= chosen.seatsLeft : false;

  if (open.length === 0) {
    return (
      <section className="panel p-5 md:p-6">
        <h2 className="text-[1rem] font-semibold">Departures</h2>
        <p className="mt-2 text-ink-2">No open departures right now. Check back soon.</p>
      </section>
    );
  }

  return (
    <section className="panel grid gap-4 p-5 md:p-6" aria-labelledby="dep-h">
      <h2 id="dep-h" className="text-[1rem] font-semibold">
        Choose a departure
      </h2>
      <fieldset className="grid gap-2">
        <legend className="sr-only">Departure</legend>
        {open.map((d) => (
          <label
            key={d.id}
            className={cx(
              "flex cursor-pointer items-center justify-between gap-3 rounded-[12px] border-[1.5px] px-3.5 py-3",
              d.id === id ? "border-primary bg-primary-soft" : "border-rule hover:border-ink",
            )}
          >
            <span className="flex items-center gap-3">
              <input
                type="radio"
                name="departure"
                value={d.id}
                checked={d.id === id}
                onChange={() => setId(d.id)}
                className="accent-[var(--pg-primary)]"
              />
              <span>
                <span className="block font-semibold">{dhakaDateTime(d.departsAt)}</span>
                <span className="text-[0.78rem] text-ink-3">
                  {d.seatsLeft} seat{d.seatsLeft === 1 ? "" : "s"} left
                </span>
              </span>
            </span>
            <span className="tabular text-right text-[0.9rem] font-semibold">
              {money(d.priceAdult)}
              <span className="block text-[0.72rem] font-normal text-ink-3">per adult</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        {(
          [
            ["Adults", adults, setAdults, 1],
            ["Children", children, setChildren, 0],
          ] as const
        ).map(([label, value, set, min]) => (
          <label key={label} className="grid gap-1">
            <span className="text-[0.78rem] font-semibold">{label}</span>
            <select
              value={value}
              onChange={(e) => set(Number(e.target.value))}
              className="h-11 rounded-control border border-rule bg-card px-3"
            >
              {Array.from({ length: 11 - min }, (_, i) => i + min).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {chosen && (
        <p className="text-[0.84rem] text-ink-2">
          Children {money(chosen.priceChild)} each. VAT is added at checkout.
        </p>
      )}
      {!fits && chosen && (
        <p className="text-[0.84rem] font-semibold text-warn">
          Only {chosen.seatsLeft} seats left on this departure.
        </p>
      )}
      <Link
        aria-disabled={!fits}
        href={
          fits
            ? `/checkout?${new URLSearchParams({ product: "TOUR", departure: id, adults: String(adults), children: String(children) })}`
            : "#"
        }
        className={buttonClass(
          "primary",
          "md",
          cx("no-underline", !fits && "pointer-events-none opacity-40"),
        )}
      >
        Hold {party} seat{party === 1 ? "" : "s"}
      </Link>
      {isAgent && fits && (
        <Link
          href={`/checkout?${new URLSearchParams({ product: "TOUR", departure: id, adults: String(adults), children: String(children), as: "agent" })}`}
          className={buttonClass("outline", "md", "no-underline")}
        >
          Book for a client
        </Link>
      )}
    </section>
  );
}
