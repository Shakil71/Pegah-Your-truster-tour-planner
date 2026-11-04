"use client";

import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { taka, takaCompact } from "@pegah/shared";
import { cx } from "@pegah/ui";

const W = 760,
  H = 280,
  L = 56,
  R = 16,
  T = 18,
  B = 34;
const RANGES = [7, 14, 30] as const;

function niceMax(v: number) {
  const p = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / p / 0.5) * 0.5 * p;
}

/** Single-series area chart with crosshair tooltip, keyboard stepping and a table view. */
export function RevenueChart({ daily, endDate }: { daily: number[]; endDate: string }) {
  const [range, setRange] = useState<(typeof RANGES)[number]>(30);
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const data = useMemo(() => daily.slice(-range), [daily, range]);
  const dates = useMemo(() => {
    const end = new Date(`${endDate}T00:00:00`);
    return data.map((_, i) => {
      const d = new Date(end);
      d.setDate(end.getDate() - (data.length - 1 - i));
      return d;
    });
  }, [data, endDate]);

  // An empty period still draws a readable axis (৳0 – ৳1,000).
  const max = niceMax(Math.max(1000, ...data));
  const x = (i: number) => L + (i * (W - L - R)) / (data.length - 1);
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const line = data.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const area = `${line}L${x(data.length - 1)},${y(0)}L${x(0)},${y(0)}Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const xEvery = range === 7 ? 1 : range === 14 ? 2 : 5;
  const total = data.reduce((a, b) => a + b, 0);
  const fmtDay = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  function onMove(e: PointerEvent<SVGSVGElement>) {
    const box = svgRef.current?.getBoundingClientRect();
    if (!box) return;
    const px = ((e.clientX - box.left) / box.width) * W;
    const i = Math.round(((px - L) / (W - L - R)) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  }
  function onKey(e: KeyboardEvent<SVGSVGElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    setHover((h) =>
      Math.max(
        0,
        Math.min(data.length - 1, (h ?? data.length - 1) + (e.key === "ArrowRight" ? 1 : -1)),
      ),
    );
  }

  const hv = hover !== null ? data[hover] : undefined;
  const hd = hover !== null ? dates[hover] : undefined;

  return (
    <section
      className="panel animate-rise p-5 md:p-6"
      aria-labelledby="rev-h"
      style={{ animationDelay: "240ms" }}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="rev-h" className="text-[0.95rem] font-semibold">
            Booking value
          </h2>
          <p className="tabular mt-1 font-display text-[1.9rem] font-medium leading-none">
            {taka(total)}
          </p>
          <p className="mt-1 text-[0.78rem] text-ink-3">
            Last {range} days · held and confirmed, incl. VAT · not revenue until paid
          </p>
        </div>
        <div
          className="flex rounded-full border border-rule bg-paper p-1"
          role="group"
          aria-label="Time range"
        >
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={r === range}
              onClick={() => {
                setRange(r);
                setHover(null);
              }}
              className={cx(
                "tabular cursor-pointer rounded-full px-3.5 py-1.5 text-[0.8rem] font-semibold transition-colors",
                r === range ? "bg-ink text-card" : "text-ink-2 hover:text-ink",
              )}
            >
              {r}d
            </button>
          ))}
        </div>
      </div>

      <div className="relative mt-4">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded-md"
          role="img"
          aria-label={`Daily booking value for the last ${range} days, total ${taka(total)}. Use left and right arrows to read each day.`}
          tabIndex={0}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          onKeyDown={onKey}
          onBlur={() => setHover(null)}
        >
          <defs>
            <linearGradient id="rev-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--pg-primary)" stopOpacity="0.32" />
              <stop offset="100%" stopColor="var(--pg-primary)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={L}
                x2={W - R}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--pg-rule)"
                strokeDasharray={t === 0 ? undefined : "3 5"}
              />
              <text
                x={L - 10}
                y={y(t)}
                dy="0.32em"
                textAnchor="end"
                fontSize="11"
                fill="var(--pg-ink-3)"
                className="tabular"
              >
                {takaCompact(t)}
              </text>
            </g>
          ))}
          {dates.map((d, i) =>
            (data.length - 1 - i) % xEvery === 0 ? (
              <text
                key={i}
                x={x(i)}
                y={H - 10}
                textAnchor="middle"
                fontSize="11"
                fill="var(--pg-ink-3)"
              >
                {range === 7 ? d.toLocaleDateString("en-GB", { weekday: "short" }) : fmtDay(d)}
              </text>
            ) : null,
          )}
          <path d={area} fill="url(#rev-fill)" />
          <path
            d={line}
            fill="none"
            stroke="var(--pg-primary)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {hover !== null && hv !== undefined && (
            <g>
              <line
                x1={x(hover)}
                x2={x(hover)}
                y1={T}
                y2={y(0)}
                stroke="var(--pg-ink)"
                strokeOpacity="0.35"
                strokeDasharray="4 4"
              />
              <circle
                cx={x(hover)}
                cy={y(hv)}
                r="5.5"
                fill="var(--pg-primary)"
                stroke="var(--pg-card)"
                strokeWidth="2.5"
              />
            </g>
          )}
        </svg>
        {hover !== null && hv !== undefined && hd && (
          <div
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-[10px] bg-night px-3 py-2 text-[0.78rem] text-white shadow-lift"
            style={{ left: `${(x(hover) / W) * 100}%` }}
          >
            <p className="text-white/70">
              {hd.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
            </p>
            <p className="tabular font-bold">{taka(hv)}</p>
          </div>
        )}
      </div>

      <details className="mt-2 text-[0.8rem] text-ink-2">
        <summary className="cursor-pointer">View as table</summary>
        <div className="mt-2 max-h-48 overflow-auto rounded-md border border-rule">
          <table className="tabular w-full text-left">
            <thead className="sticky top-0 bg-paper">
              <tr>
                <th className="px-3 py-1.5 font-semibold">Date</th>
                <th className="px-3 py-1.5 text-right font-semibold">Booking value</th>
              </tr>
            </thead>
            <tbody>
              {data.map((v, i) => (
                <tr key={i} className="border-t border-rule">
                  <td className="px-3 py-1">{dates[i] ? fmtDay(dates[i]) : ""}</td>
                  <td className="px-3 py-1 text-right">{taka(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
