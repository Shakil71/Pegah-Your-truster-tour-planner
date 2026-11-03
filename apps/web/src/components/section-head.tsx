import type { ReactNode } from "react";

/** Eyebrow + display heading (with one italic orange word) + optional aside. */
export function SectionHead({
  eyebrow,
  title,
  aside,
  id,
}: {
  eyebrow: string;
  title: ReactNode;
  aside?: ReactNode;
  id?: string;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
      <div>
        <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-primary-ink">
          {eyebrow}
        </p>
        <h2
          id={id}
          className="mt-2.5 max-w-[17ch] font-display text-[clamp(2.1rem,4.2vw,3.4rem)] font-medium leading-[1.02] tracking-[-0.01em] [&_em]:text-primary-ink"
        >
          {title}
        </h2>
      </div>
      {aside}
    </div>
  );
}

export function SampleNote({ children }: { children: ReactNode }) {
  return (
    <p className="mt-6 inline-flex rounded-full border border-dashed border-thread px-2.5 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-thread">
      {children}
    </p>
  );
}
