import { useTranslations } from "next-intl";
import { Icon } from "@pegah/ui";
import { promises } from "@/data/home";
import { useContent } from "@/data/home.bn";

import { SectionHead } from "./section-head";

export function Promises() {
  const t = useTranslations("home");
  const c = useContent();
  return (
    <section
      className="px-[max(16px,env(safe-area-inset-left,0px))] pt-28"
      aria-labelledby="promise-h"
    >
      <div className="mx-auto max-w-[1280px]">
        <SectionHead
          id="promise-h"
          eyebrow={t("promisesEyebrow")}
          title={t.rich("promisesTitle", { em: (chunks) => <em>{chunks}</em> })}
        />
        <ul className="grid gap-6 md:grid-cols-3">
          {promises.map((p) => (
            <li
              key={p.title}
              className="grid content-start gap-3 rounded-card border border-rule bg-card p-8"
            >
              <Icon name={p.icon} className="size-[34px] text-primary-ink" />
              <h3 className="font-display text-[1.5rem] font-medium leading-[1.15]">
                {c(p.title)}
              </h3>
              <p className="m-0 text-ink-2">{c(p.body)}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
