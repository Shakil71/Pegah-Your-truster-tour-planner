"use client";

import Image from "next/image";
import { useState } from "react";
import { RITUS, type RituKey } from "@pegah/shared";
import { cx } from "@pegah/ui";
import { seasonGuide } from "@/data/home";

export function SeasonsPanel({ current }: { current: RituKey }) {
  const [active, setActive] = useState<RituKey>(current);
  const guide = seasonGuide[active];

  return (
    <section className="px-[max(16px,env(safe-area-inset-left,0px))] pt-28" aria-labelledby="sea-h">
      <div className="mx-auto grid max-w-[1280px] overflow-hidden rounded-card bg-night text-white lg:grid-cols-[1.1fr_1fr] lg:gap-12">
        <div className="relative min-h-[300px] lg:min-h-[480px]">
          {RITUS.map((r) => (
            <Image
              key={r.key}
              src={seasonGuide[r.key].photo.src}
              alt=""
              fill
              sizes="(min-width: 1024px) 55vw, 100vw"
              className={cx(
                "object-cover transition-opacity duration-700 ease-pegah",
                r.key === active ? "opacity-100" : "opacity-0",
              )}
            />
          ))}
          <span className="absolute bottom-4 left-[18px] z-[1] font-display text-[1.3rem] italic text-white [text-shadow:0_1px_12px_rgb(0_0_0/0.5)]">
            {guide.caption}
          </span>
        </div>
        <div className="grid content-center gap-4 px-6 py-8 lg:py-12 lg:pl-0 lg:pr-12">
          <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-primary">
            Six seasons, not four
          </p>
          <h2
            id="sea-h"
            className="font-display text-[clamp(2rem,3.6vw,3rem)] font-medium leading-[1.05]"
          >
            Go where the season is right.
          </h2>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Choose a season">
            {RITUS.map((r) => (
              <button
                key={r.key}
                type="button"
                aria-pressed={r.key === active}
                onClick={() => setActive(r.key)}
                className={cx(
                  "relative grid cursor-pointer gap-px rounded-control border border-dashed px-3 pb-2.5 pt-3 text-left transition-colors",
                  r.key === active
                    ? "border-solid border-on-night bg-on-night text-fixed-ink"
                    : "border-white/25 bg-white/5 hover:bg-white/10",
                )}
              >
                {r.key === current && (
                  <span
                    className={cx(
                      "absolute right-2.5 top-2 text-[0.58rem] font-bold uppercase tracking-[0.12em]",
                      r.key === active ? "text-fixed-accent" : "text-primary",
                    )}
                  >
                    Now
                  </span>
                )}
                <span lang="bn" className="font-bn text-[1.15rem] leading-[1.3]">
                  {r.bn}
                </span>
                <span className="text-[0.86rem] font-semibold">{r.en}</span>
                <span className="text-[0.7rem] opacity-70">{r.months}</span>
              </button>
            ))}
          </div>
          <p aria-live="polite" className="m-0 min-h-[3.3em] text-white/85">
            {guide.note}
          </p>
          <div className="flex flex-wrap gap-2">
            {guide.go.map((g) => (
              <a
                key={g}
                href="#stays"
                className="rounded-full border border-white/40 px-3.5 py-1.5 text-[0.86rem] text-white hover:bg-primary hover:text-on-primary hover:border-primary"
              >
                {g} →
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
