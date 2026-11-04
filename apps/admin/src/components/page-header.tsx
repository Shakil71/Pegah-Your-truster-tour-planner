import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@pegah/ui";

/** Consistent page heading for console pages: back link, eyebrow, title, intro, actions. */
export function PageHeader({
  eyebrow,
  title,
  intro,
  back,
  actions,
}: {
  eyebrow: string;
  title: ReactNode;
  intro?: ReactNode;
  back?: { href: string; label: string };
  actions?: ReactNode;
}) {
  return (
    <div className="animate-rise">
      {back && (
        <Link
          href={back.href}
          className="mb-3 inline-flex items-center gap-1 text-[0.84rem] font-semibold text-ink-2 hover:text-ink"
        >
          <Icon name="arrowLeft" className="size-4" /> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-primary-ink">
            {eyebrow}
          </p>
          <h1 className="mt-1.5 font-display text-[clamp(1.9rem,3vw,2.5rem)] font-medium leading-tight">
            {title}
          </h1>
          {intro && <p className="mt-1 max-w-[72ch] text-ink-2">{intro}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
      </div>
    </div>
  );
}
