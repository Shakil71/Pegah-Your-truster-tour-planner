import Image from "next/image";
import { useTranslations } from "next-intl";
import { Icon } from "@pegah/ui";
import { taka } from "@pegah/shared";
import { stays } from "@/data/home";
import { useContent } from "@/data/home.bn";

import { SampleNote, SectionHead } from "./section-head";
import { WishlistButton } from "./wishlist-button";

export function StaysGrid() {
  const t = useTranslations("home");
  const c = useContent();
  return (
    <section
      id="stays"
      className="px-[max(16px,env(safe-area-inset-left,0px))] pt-28"
      aria-labelledby="stays-h"
    >
      <div className="mx-auto max-w-[1280px]">
        <SectionHead
          id="stays-h"
          eyebrow={t("staysEyebrow")}
          title={t.rich("staysTitle", { em: (chunks) => <em>{chunks}</em> })}
          aside={<p className="m-0 max-w-[42ch] text-ink-2">{t("staysIntro")}</p>}
        />
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {stays.map((s) => (
            <li key={s.name} className="group relative grid min-w-0 gap-3">
              <div className="relative aspect-[4/3.3] overflow-hidden rounded-card bg-paper-2">
                <Image
                  src={s.photo.src}
                  alt={s.photo.alt}
                  fill
                  sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
                  placeholder="blur"
                  className="object-cover transition-transform duration-700 ease-pegah group-hover:scale-105"
                />
                <WishlistButton label={c(s.name)} />
                {s.freeCancellation && (
                  <span className="absolute bottom-3 left-3 rounded-full bg-white/95 px-2.5 py-1 text-[0.74rem] font-bold text-fixed-good">
                    {t("freeCancellation")}
                  </span>
                )}
              </div>
              <div className="flex items-baseline justify-between gap-2.5">
                <h3 className="text-[1.04rem] font-bold leading-[1.3]">
                  <a href="#stays" className="after:absolute after:inset-0 hover:underline">
                    {c(s.name)}
                  </a>
                </h3>
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[0.86rem] font-bold">
                  <span className="grid size-[26px] place-items-center rounded-full border-[1.5px] border-dashed border-primary text-[0.72rem] text-primary-ink">
                    {s.score.toFixed(1)}
                  </span>
                  {c(s.scoreLabel)}
                </span>
              </div>
              <p className="-mt-2 text-[0.86rem] text-ink-2">{c(s.location)}</p>
              <ul className="flex gap-3 text-ink-2" aria-label={t("amenities")}>
                {s.amenities.map((a) => (
                  <li key={a.label}>
                    <Icon name={a.icon} label={c(a.label)} className="size-[18px]" />
                  </li>
                ))}
              </ul>
              <p className="tabular flex items-baseline gap-1.5 border-t border-dashed border-rule pt-2.5">
                <b className="text-[1.2rem]">{taka(s.pricePerNight)}</b>
                <small className="text-[0.8rem] text-ink-2">{t("perNightVat")}</small>
              </p>
            </li>
          ))}
        </ul>
        <SampleNote>{t("sampleStays")}</SampleNote>
      </div>
    </section>
  );
}
