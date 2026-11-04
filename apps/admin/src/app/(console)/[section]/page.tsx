import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon, buttonClass } from "@pegah/ui";
import { plannedSections } from "@/lib/nav";

export function generateStaticParams() {
  return plannedSections.map((s) => ({ section: s.href.slice(1) }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string }>;
}): Promise<Metadata> {
  const { section } = await params;
  return { title: plannedSections.find((s) => s.href === `/${section}`)?.label ?? "Not found" };
}

/** Designed placeholder for admin modules scheduled in later phases. */
export default async function PlannedSection({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const item = plannedSections.find((s) => s.href === `/${section}`);
  if (!item) notFound();

  return (
    <div className="mx-auto grid max-w-[1440px] gap-6">
      <div>
        <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-primary-ink">
          {item.phase}
        </p>
        <h1 className="mt-1.5 font-display text-[clamp(1.9rem,3vw,2.5rem)] font-medium leading-tight">
          {item.label}
        </h1>
      </div>
      <section className="panel animate-rise relative grid place-items-center overflow-hidden px-6 py-20 text-center">
        <div aria-hidden="true" className="absolute inset-x-0 top-0 stitch" />
        <span className="grid size-16 place-items-center rounded-full bg-primary-soft text-primary-ink">
          <Icon name={item.icon} className="size-8" />
        </span>
        <h2 className="mt-5 font-display text-[1.7rem] font-medium">
          {item.label} arrives in {item.phase}
        </h2>
        <p className="mt-2 max-w-[52ch] text-ink-2">
          This module is planned in the roadmap and will be built on the admin API with role-based
          access and audit logging. See docs/FEATURE_MATRIX.md for its status.
        </p>
        <Link href="/" className={buttonClass("ink", "md", "mt-6")}>
          <Icon name="arrowLeft" className="size-[18px]" />
          Back to dashboard
        </Link>
      </section>
    </div>
  );
}
