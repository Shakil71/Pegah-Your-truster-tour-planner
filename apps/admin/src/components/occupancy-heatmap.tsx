"use client";

import { useState } from "react";
import { sequentialPrimary } from "@pegah/design-tokens";

const bins = [20, 40, 60, 75, 90] as const;
function colorFor(v: number) {
  const i = bins.findIndex((b) => v < b);
  return sequentialPrimary[i === -1 ? sequentialPrimary.length - 1 : i];
}

/** Properties × next 14 days, single-hue sequential ramp, per-cell hover tooltip. */
export function OccupancyHeatmap({
  properties,
  grid,
  days,
}: {
  properties: string[];
  grid: number[][];
  days: string[];
}) {
  const [hover, setHover] = useState<{ p: number; d: number } | null>(null);
  const hv = hover ? grid[hover.p]?.[hover.d] : undefined;

  return (
    <section
      className="panel animate-rise p-5 md:p-6"
      aria-labelledby="occ-h"
      style={{ animationDelay: "360ms" }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 id="occ-h" className="text-[0.95rem] font-semibold">
            Occupancy, next 14 days
          </h2>
          <p className="mt-1 text-[0.78rem] text-ink-3">Rooms sold or held ÷ rooms available</p>
        </div>
        <p className="tabular h-5 text-[0.8rem] text-ink-2" aria-live="polite">
          {hover && hv !== undefined ? `${properties[hover.p]} · ${days[hover.d]} · ${hv}%` : ""}
        </p>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table
          className="w-full min-w-[640px] border-separate border-spacing-[3px]"
          onMouseLeave={() => setHover(null)}
        >
          <thead>
            <tr>
              <th className="w-[170px]" />
              {days.map((d, i) => (
                <th
                  key={d}
                  scope="col"
                  className={`pb-1 text-center text-[0.66rem] font-semibold ${i % 7 === 0 ? "text-ink" : "text-ink-3"}`}
                >
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {properties.map((name, p) => (
              <tr key={name}>
                <th scope="row" className="truncate pr-3 text-left text-[0.8rem] font-medium">
                  {name}
                </th>
                {days.map((d, di) => {
                  const v = grid[p]?.[di] ?? 0;
                  const on = hover?.p === p && hover?.d === di;
                  return (
                    <td key={d} className="p-0">
                      <button
                        type="button"
                        aria-label={`${name}, ${d}: ${v}% occupied`}
                        onMouseEnter={() => setHover({ p, d: di })}
                        onFocus={() => setHover({ p, d: di })}
                        onBlur={() => setHover(null)}
                        className={`block h-8 w-full cursor-default rounded-[6px] transition-transform ${on ? "scale-110 ring-2 ring-ink" : ""}`}
                        style={{ background: colorFor(v) }}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div
        className="mt-4 flex flex-wrap items-center gap-2 text-[0.72rem] text-ink-3"
        aria-label="Legend"
      >
        <span>Occupancy</span>
        {sequentialPrimary.map((c, i) => (
          <span key={c} className="flex items-center gap-1">
            <span className="inline-block h-3 w-6 rounded-[3px]" style={{ background: c }} />
            {["<20%", "20–39", "40–59", "60–74", "75–89", "90%+"][i]}
          </span>
        ))}
      </div>
    </section>
  );
}
