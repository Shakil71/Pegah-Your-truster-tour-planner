"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import { Icon } from "@pegah/ui";
import { taka } from "@pegah/shared";
import { trending } from "@/data/home";
import { useContent } from "@/data/home.bn";

import { usePrefersReducedMotion } from "@/lib/use-browser";
import { SampleNote, SectionHead } from "./section-head";

export function TrendingRail({ season }: { season: string }) {
  const t = useTranslations("home");
  const c = useContent();
  const rail = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  function scroll(dir: 1 | -1) {
    const el = rail.current;
    if (!el) return;
    const tile = el.querySelector("a");
    const step = tile ? tile.getBoundingClientRect().width + 16 : 300;
    el.scrollBy({ left: dir * step, behavior: reduced ? "auto" : "smooth" });
  }

  return (
    <section
      className="px-[max(16px,env(safe-area-inset-left,0px))] pt-28"
      aria-labelledby="trend-h"
    >
      <div className="mx-auto max-w-[1280px]">
        <SectionHead
          id="trend-h"
          eyebrow={t("trendingEyebrow", { season })}
          title={t.rich("trendingTitle", { em: (chunks) => <em>{chunks}</em> })}
          aside={
            <div className="flex gap-2">
              {([-1, 1] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => scroll(d)}
                  aria-label={d < 0 ? t("scrollLeft") : t("scrollRight")}
                  className="grid size-[46px] cursor-pointer place-items-center rounded-full border-[1.5px] border-ink hover:bg-ink hover:text-card"
                >
                  <Icon name={d < 0 ? "arrowLeft" : "arrowRight"} />
                </button>
              ))}
            </div>
          }
        />
        <div
          ref={rail}
          tabIndex={0}
          aria-label={t("trendingLabel")}
          className="grid snap-x snap-mandatory auto-cols-[74%] grid-flow-col gap-4 overflow-x-auto pb-2.5 [scrollbar-width:thin] md:auto-cols-[minmax(250px,23%)]"
        >
          {trending.map((place) => (
            <a
              key={place.name}
              href="#stays"
              className="group relative aspect-[3/4.2] snap-start overflow-hidden rounded-card bg-night text-white"
            >
              <Image
                src={place.photo.src}
                alt={place.photo.alt}
                fill
                sizes="(min-width: 768px) 23vw, 74vw"
                placeholder="blur"
                className="object-cover transition-transform duration-700 ease-pegah group-hover:scale-[1.06]"
              />
              <span className="scrim-bottom absolute inset-0" />
              {place.tag && (
                <span className="absolute left-3.5 top-3.5 z-[1] rounded-full bg-primary px-2.5 py-1 text-[0.66rem] font-bold uppercase tracking-[0.1em] text-on-primary">
                  {c(place.tag)}
                </span>
              )}
              <span className="absolute inset-x-[18px] bottom-[18px] z-[1] grid gap-1">
                <span className="font-display text-[1.7rem] font-medium leading-[1.05]">
                  {c(place.name)}
                </span>
                <span className="text-[0.84rem] opacity-85">{c(place.sub)}</span>
                <span className="tabular mt-2 justify-self-start rounded-full bg-white/95 px-3 py-1 text-[0.82rem] text-ink">
                  {t.rich("fromPerNight", { b: () => <b>{taka(place.from)}</b> })}
                </span>
              </span>
            </a>
          ))}
        </div>
        <SampleNote>{t("samplePrices")}</SampleNote>
      </div>
    </section>
  );
}
