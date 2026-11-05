"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { buttonClass } from "@pegah/ui";
import { taka } from "@pegah/shared";
import { featuredTour, tours } from "@/data/home";
import { useContent } from "@/data/home.bn";

import { SampleNote, SectionHead } from "./section-head";

export function ToursSection() {
  const t = useTranslations("home");
  const c = useContent();
  const [dep, setDep] = useState(0);
  const [holdMsg, setHoldMsg] = useState("");
  const chosen = featuredTour.departures[dep] ?? featuredTour.departures[0]!;

  return (
    <section
      id="tours"
      className="px-[max(16px,env(safe-area-inset-left,0px))] pt-28"
      aria-labelledby="tours-h"
    >
      <div className="mx-auto max-w-[1280px]">
        <SectionHead
          id="tours-h"
          eyebrow={t("toursEyebrow")}
          title={t.rich("toursTitle", { em: (chunks) => <em>{chunks}</em> })}
          aside={<p className="m-0 max-w-[42ch] text-ink-2">{t("toursIntro")}</p>}
        />
        <div className="grid gap-8 lg:grid-cols-[1.25fr_1fr]">
          <article className="relative grid min-h-[560px] content-end overflow-hidden rounded-card bg-night text-white">
            <Image
              src={featuredTour.photo.src}
              alt={featuredTour.photo.alt}
              fill
              sizes="(min-width: 1024px) 55vw, 100vw"
              placeholder="blur"
              className="object-cover"
            />
            <span className="absolute inset-0 bg-[linear-gradient(180deg,rgb(9_12_34/0)_25%,rgb(9_12_34/0.9)_100%)]" />
            <div className="relative z-[1] grid gap-3.5 p-8">
              <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-primary">
                {c(featuredTour.label)}
              </p>
              <h3 className="font-display text-[clamp(2rem,3.4vw,2.7rem)] font-medium leading-[1.05]">
                {c(featuredTour.name)}
              </h3>
              <ul className="flex flex-wrap gap-x-[18px] gap-y-1.5 text-[0.88rem] opacity-90">
                {featuredTour.facts.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2" role="group" aria-label={t("chooseDeparture")}>
                {featuredTour.departures.map((d, i) => (
                  <button
                    key={d.date}
                    type="button"
                    aria-pressed={i === dep}
                    onClick={() => {
                      setDep(i);
                      setHoldMsg("");
                    }}
                    className={`tabular cursor-pointer rounded-full border-[1.5px] px-3.5 py-1.5 text-[0.85rem] ${i === dep ? "border-white bg-white text-fixed-ink" : "border-dashed border-white/60"}`}
                  >
                    {d.date}
                    <span
                      className={`ml-1.5 font-bold ${i === dep ? "text-fixed-accent" : "text-primary"}`}
                    >
                      {t("seatsLeft", { count: d.seatsLeft })}
                    </span>
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-end justify-between gap-3.5 border-t border-dashed border-white/30 pt-3.5">
                <div>
                  <small className="block text-[0.8rem] opacity-80">{t("perPersonSharing")}</small>
                  <p className="tabular font-display text-[2.2rem] leading-none">
                    {taka(chosen.price)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setHoldMsg(t("prototypeHold", { date: chosen.date }))}
                  className={buttonClass("primary", "md", "h-12 px-6")}
                >
                  {holdMsg || t("holdMyPlace")}
                </button>
              </div>
            </div>
          </article>
          <ul className="grid content-start gap-4">
            {tours.map((tour) => (
              <li key={tour.name}>
                <a
                  href="#tours"
                  className="grid grid-cols-[100px_minmax(0,1fr)] gap-4 rounded-card border border-rule bg-card p-3 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-lift sm:grid-cols-[150px_minmax(0,1fr)]"
                >
                  <span className="relative min-h-32 overflow-hidden rounded-control">
                    <Image
                      src={tour.photo.src}
                      alt={tour.photo.alt}
                      fill
                      sizes="150px"
                      className="object-cover"
                    />
                  </span>
                  <span className="grid content-center gap-1 py-1 pr-1.5">
                    <span className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-primary-ink">
                      {c(tour.label)}
                    </span>
                    <span className="font-display text-[1.28rem] font-medium leading-[1.15]">
                      {c(tour.name)}
                    </span>
                    <span className="text-[0.86rem] text-ink-2">{c(tour.blurb)}</span>
                    <span className="tabular text-[0.9rem]">
                      {t.rich("from", { b: () => <b>{taka(tour.from)}</b> })}
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
        <SampleNote>{t("sampleTours")}</SampleNote>
      </div>
    </section>
  );
}
