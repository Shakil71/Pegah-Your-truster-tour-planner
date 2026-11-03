import { Icon } from "@pegah/ui";
import { promises } from "@/data/home";
import { SectionHead } from "./section-head";

export function Promises() {
  return (
    <section
      className="px-[max(16px,env(safe-area-inset-left,0px))] pt-28"
      aria-labelledby="promise-h"
    >
      <div className="mx-auto max-w-[1280px]">
        <SectionHead
          id="promise-h"
          eyebrow="How we plan"
          title={
            <>
              What you can <em>hold us</em> to
            </>
          }
        />
        <ul className="grid gap-6 md:grid-cols-3">
          {promises.map((p) => (
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
