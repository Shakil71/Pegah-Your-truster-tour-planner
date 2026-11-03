import Image from "next/image";
import { Icon, cx } from "@pegah/ui";
import { moods } from "@/data/home";
import { SectionHead } from "./section-head";

const placement = [
  "col-span-2 md:row-span-2 min-h-[300px] md:min-h-0",
  "min-h-[220px] md:min-h-0",
  "min-h-[220px] md:min-h-0",
  "min-h-[220px] md:min-h-0 md:row-span-2",
  "min-h-[220px] md:min-h-0",
  "min-h-[220px] md:min-h-0",
];

export function MoodMosaic() {
  return (
    <section
      id="explore"
      className="px-[max(16px,env(safe-area-inset-left,0px))] pt-28"
      aria-labelledby="mood-h"
    >
      <div className="mx-auto max-w-[1280px]">
        <SectionHead
          id="mood-h"
          eyebrow="Explore by mood"
          title={
            <>
              Six ways to <em>see</em> Bangladesh
            </>
          }
          aside={
            <p className="m-0 max-w-[42ch] text-ink-2">
              From mangrove creeks to Mughal ruins. Start with how you want the trip to feel.
            </p>
          }
        />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:grid-rows-[260px_260px]">
          {moods.map((m, i) => (
            <a
              key={m.name}
              href="#tours"
              className={cx(
                "group relative min-w-0 overflow-hidden rounded-card bg-night text-white",
                placement[i],
              )}
            >
              <Image
                src={m.photo.src}
                alt={m.photo.alt}
                fill
                sizes={i === 0 ? "(min-width: 768px) 50vw, 100vw" : "(min-width: 768px) 25vw, 50vw"}
                placeholder="blur"
                className="object-cover transition-transform duration-[800ms] ease-pegah group-hover:scale-105"
              />
              <span className="absolute inset-0 bg-[linear-gradient(200deg,rgb(9_12_34/0)_40%,rgb(9_12_34/0.8)_100%)]" />
              <span className="absolute right-4 top-4 z-[1] grid size-10 translate-y-1.5 place-items-center rounded-full bg-primary text-on-primary opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:opacity-100">
                <Icon name="arrowRight" />
              </span>
              <span className="absolute inset-x-5 bottom-[18px] z-[1]">
                <span className="block text-[0.7rem] font-bold uppercase tracking-[0.16em] text-primary">
                  {m.mood}
                </span>
                <span
                  className={cx(
                    "mt-1 block font-display font-medium leading-[1.1]",
                    i === 0 ? "text-[clamp(2rem,3.4vw,2.8rem)]" : "text-[1.6rem]",
                  )}
                >
                  {m.name}
                </span>
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
