import Image from "next/image";
import { cx } from "@pegah/ui";
import type { Departure } from "@/data/sample";

export function Departures({ items }: { items: Departure[] }) {
  return (
    <section
      className="panel animate-rise p-5 md:p-6"
      aria-labelledby="dep-h"
      style={{ animationDelay: "420ms" }}
    >
      <h2 id="dep-h" className="text-[0.95rem] font-semibold">
        Upcoming departures
      </h2>
      <p className="mt-1 text-[0.78rem] text-ink-3">Seats booked of capacity</p>
      <ul className="mt-4 grid gap-4">
        {items.map((d) => {
          const pct = Math.round((d.booked / d.capacity) * 100);
          const full = d.booked >= d.capacity;
          return (
            <li
              key={d.name + d.date}
              className="grid grid-cols-[52px_minmax(0,1fr)] items-center gap-3"
            >
              <span className="relative size-[52px] overflow-hidden rounded-[12px]">
                <Image src={d.photo} alt="" fill sizes="52px" className="object-cover" />
              </span>
              <div className="min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-[0.86rem] font-semibold">{d.name}</p>
                  <p className="tabular shrink-0 text-[0.78rem] font-bold">
                    {d.booked}/{d.capacity}
                  </p>
                </div>
                <p className="text-[0.74rem] text-ink-3">
                  {d.date}
                  {full && " · sold out"}
                </p>
                <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-paper-2">
                  <span
                    className={cx("block h-full rounded-full", full ? "bg-ink" : "bg-primary")}
                    style={{ width: `${pct}%` }}
                  />
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
