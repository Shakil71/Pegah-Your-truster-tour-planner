import { useTranslations } from "next-intl";
import { Icon } from "@pegah/ui";
import { promises } from "@/data/home";
import { useContent } from "@/data/home.bn";

import { SectionHead } from "./section-head";

/** Promise cards; the console can replace the built-in three (ADR-0031). */
export function Promises({ items }: { items?: { title: string; body: string }[] }) {
  const t = useTranslations("home");
  const c = useContent();
  const cards =
    items && items.length > 0
      ? items.map((p, i) => ({ ...p, icon: promises[i % promises.length]!.icon }))
      : promises.map((p) => ({ icon: p.icon, title: c(p.title), body: c(p.body) }));
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
          {cards.map((p) => (
            <li
              key={p.title}
              className="grid content-start gap-3 rounded-card border border-rule bg-card p-8"
            >
              <Icon name={p.icon} className="size-[34px] text-primary-ink" />
              <h3 className="font-display text-[1.5rem] font-medium leading-[1.15]">{p.title}</h3>
              <p className="m-0 text-ink-2">{p.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
