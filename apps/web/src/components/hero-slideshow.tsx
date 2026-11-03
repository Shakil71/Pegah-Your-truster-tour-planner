"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { cx } from "@pegah/ui";
import { heroSlides } from "@/data/home";
import { usePrefersReducedMotion } from "@/lib/use-browser";

const INTERVAL_MS = 6500;

/** Full-bleed crossfading hero with stitch-line progress and a pause control (WCAG 2.2.2). */
export function HeroSlideshow() {
  const [current, setCurrent] = useState(0);
  const reducedMotion = usePrefersReducedMotion();
  const [userPaused, setUserPaused] = useState<boolean | null>(null);
  const paused = userPaused ?? reducedMotion;
  const [cycle, setCycle] = useState(0);

  const go = useCallback((i: number) => {
    setCurrent((i + heroSlides.length) % heroSlides.length);
    setCycle((c) => c + 1);
  }, []);

  useEffect(() => {
    if (paused) return;
    const id = window.setTimeout(() => go(current + 1), INTERVAL_MS);
    return () => window.clearTimeout(id);
  }, [current, paused, go, cycle]);

  const slide = heroSlides[current] ?? heroSlides[0]!;

  return (
    <section
      aria-label="Featured places"
      className="relative h-auto min-h-[640px] overflow-hidden bg-night text-white md:h-[clamp(600px,86vh,860px)]"
    >
      {heroSlides.map((s, i) => (
        <div
          key={s.place}
          aria-hidden={i !== current}
          className={cx(
            "absolute inset-0 transition-opacity duration-[1400ms] ease-pegah",
            i === current ? "opacity-100" : "opacity-0",
          )}
        >
          <Image
            key={i === current ? `on-${cycle}` : "off"}
            src={s.src}
            alt={s.alt}
            fill
            priority={i === 0}
            sizes="100vw"
            placeholder="blur"
            className={cx("object-cover", i === current && "animate-drift")}
          />
        </div>
      ))}
      <div className="scrim-hero pointer-events-none absolute inset-0" />

      <div className="absolute inset-x-0 top-[120px] z-[2] px-[max(16px,env(safe-area-inset-left,0px))] md:top-auto md:bottom-[150px]">
        <div className="mx-auto max-w-[1280px]">
          <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-primary">
            Stays · Tours · Planning across Bangladesh
          </p>
          <h1 className="mt-3.5 max-w-[12ch] font-display text-[clamp(2.9rem,7.4vw,6.6rem)] font-medium leading-[0.95] tracking-[-0.03em] [text-shadow:0_2px_30px_rgb(0_0_0/0.25)]">
            Bangladesh, <em className="text-primary">beautifully</em> booked.
          </h1>
          <p className="mt-[18px] max-w-[40ch] text-[1.1rem] text-white/90">
            Tea-country bungalows, Sundarbans launches and haor houseboats. Real prices in taka,
            confirmed by the people who host you.
          </p>
        </div>
      </div>

      <div className="absolute inset-x-4 bottom-[60px] z-[2] grid justify-items-start gap-2.5 md:inset-x-auto md:right-[max(16px,env(safe-area-inset-right,0px))] md:bottom-[150px] md:justify-items-end md:text-right">
        <p className="font-display text-[1.35rem] italic" aria-live="polite">
          {slide.place}
        </p>
        <p className="text-[0.7rem] opacity-75">{slide.credit}</p>
        <div className="flex items-center gap-1.5" role="group" aria-label="Choose photo">
          {heroSlides.map((s, i) => (
            <button
              key={s.place}
              type="button"
              aria-label={`Show ${s.place}`}
              aria-current={i === current}
              onClick={() => go(i)}
              className="grid h-[18px] w-[34px] cursor-pointer items-center"
            >
              <span className="relative block h-0.5 overflow-hidden bg-[linear-gradient(90deg,rgb(255_255_255/0.55)_0_6px,transparent_6px_10px)] bg-[length:10px_2px]">
                {i === current && (
                  <span
                    key={cycle}
                    className={cx(
                      "absolute inset-0 origin-left scale-x-0 bg-white",
                      !paused && "animate-fill",
                      paused && "scale-x-100",
                    )}
                  />
                )}
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setUserPaused(!paused)}
            aria-label={paused ? "Play slideshow" : "Pause slideshow"}
            className="ml-1.5 grid size-[30px] cursor-pointer place-items-center rounded-full border-[1.5px] border-white/70 bg-night/25"
          >
            <svg viewBox="0 0 12 12" className="size-3 fill-current" aria-hidden="true">
              {paused ? (
                <path d="M3 1.5v9l7.5-4.5z" />
              ) : (
                <path d="M2.5 1.5h2.5v9H2.5zM7 1.5h2.5v9H7z" />
              )}
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}
