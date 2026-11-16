import type { ReactNode } from "react";
import { Icon, cx } from "@pegah/ui";
import { labelled, type Block, type Group, type Itinerary } from "@/lib/tour-details";

type IconName = Parameters<typeof Icon>[0]["name"];

/** One titled card on the tour page; `id` is the in-page link target. */
export function TourSection({
  id,
  icon,
  title,
  children,
  className,
}: {
  id: string;
  icon: IconName;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-h`}
      className={cx("panel scroll-mt-[150px] p-5 md:p-7", className)}
    >
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary-ink">
          <Icon name={icon} className="size-5" />
        </span>
        <h2 id={`${id}-h`} className="font-display text-[1.45rem] font-medium leading-tight">
          {title}
        </h2>
      </div>
      <div className="mt-5 grid gap-5">{children}</div>
    </section>
  );
}

/** A point with a bold lead-in when written "Breakfast: Paratha, egg". */
function PointText({ text }: { text: string }) {
  const row = labelled(text);
  return row ? (
    <span className="min-w-0">
      <b className="font-semibold text-ink">{row.label}:</b> {row.value}
    </span>
  ) : (
    <span className="min-w-0">{text}</span>
  );
}

export function CheckList({
  items,
  tone = "good",
  columns = false,
}: {
  items: string[];
  tone?: "good" | "muted" | "primary";
  columns?: boolean;
}) {
  return (
    <ul
      className={cx(
        "grid gap-x-6 gap-y-2.5 text-[0.93rem] leading-snug text-ink-2",
        columns && "md:grid-cols-2",
      )}
    >
      {items.map((p, i) => (
        <li key={`${i}-${p}`} className="flex items-start gap-2.5">
          <span
            className={cx(
              "mt-[1px] grid size-5 shrink-0 place-items-center rounded-full",
              tone === "good" && "bg-good-soft text-good",
              tone === "muted" && "bg-paper-2 text-ink-3",
              tone === "primary" && "bg-primary-soft text-primary-ink",
            )}
          >
            <Icon name={tone === "muted" ? "x" : "check"} className="size-3.5" />
          </span>
          <PointText text={p} />
        </li>
      ))}
    </ul>
  );
}

/** Key facts ("Package Duration", "Condition") as a two-column sheet. */
export function FactSheet({ rows }: { rows: Array<{ label: string; value: string }> }) {
  return (
    <dl className="grid overflow-hidden rounded-[14px] border border-rule md:grid-cols-2">
      {rows.map((r, i) => (
        <div
          key={`${i}-${r.label}`}
          className={cx(
            "grid gap-1 border-rule bg-paper-2/40 p-4",
            i > 0 && "border-t",
            i === 1 && "md:border-t-0",
            i % 2 === 1 && "md:border-l",
            // A last row on its own spans both columns.
            i === rows.length - 1 && i % 2 === 0 && "md:col-span-2",
          )}
        >
          <dt className="text-[0.72rem] font-bold uppercase tracking-[0.12em] text-ink-3">
            {r.label}
          </dt>
          <dd className="text-[0.93rem] text-ink">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Description: paragraphs, headings and lists in order; label rows gathered into a fact sheet. */
export function DescriptionBlocks({ blocks }: { blocks: Block[] }) {
  const rows = blocks.filter((b): b is Extract<Block, { type: "row" }> => b.type === "row");
  const rest = blocks.filter((b) => b.type !== "row");
  return (
    <>
      {rest.length > 0 && (
        <div className="grid gap-3 text-[0.97rem] leading-relaxed text-ink-2">
          {rest.map((b, i) =>
            b.type === "para" ? (
              <p key={i}>{b.text}</p>
            ) : b.type === "heading" ? (
              <h3
                key={i}
                className="mt-2 text-[0.76rem] font-bold uppercase tracking-[0.12em] text-ink-3"
              >
                {b.text}
              </h3>
            ) : b.type === "points" ? (
              <CheckList key={i} items={b.items} tone="primary" columns={b.items.length > 4} />
            ) : null,
          )}
        </div>
      )}
      {rows.length > 0 && <FactSheet rows={rows} />}
    </>
  );
}

/** Day-by-day timeline: a numbered marker per day, a clock pill on timed steps. */
export function ItineraryTimeline({
  itinerary,
  dayLabel,
}: {
  itinerary: Itinerary;
  dayLabel: string;
}) {
  return (
    <>
      {(itinerary.title || itinerary.intro.length > 0 || itinerary.notes.length > 0) && (
        <div className="grid gap-3">
          {itinerary.title && (
            <p className="font-display text-[1.15rem] font-medium text-ink">{itinerary.title}</p>
          )}
          {itinerary.intro.length > 0 && <FactSheet rows={itinerary.intro} />}
          {itinerary.notes.map((n, i) => (
            <p key={i} className="text-[0.93rem] text-ink-2">
              {n}
            </p>
          ))}
        </div>
      )}
      <ol className="grid">
        {itinerary.days.map((d, k) => (
          <li
            key={k}
            className="relative grid grid-cols-[44px_minmax(0,1fr)] gap-x-4 pb-7 last:pb-0"
          >
            {/* The thread joining the days. */}
            {k < itinerary.days.length - 1 && (
              <span
                aria-hidden
                className="absolute bottom-0 left-[21px] top-11 w-0 border-l-2 border-dashed border-thread"
              />
            )}
            <span className="tabular grid size-11 place-items-center rounded-full bg-primary text-[0.95rem] font-bold text-on-primary">
              {d.day}
            </span>
            <div className="min-w-0 pt-1.5">
              <h3 className="text-[1.02rem] font-semibold leading-snug text-ink">
                {dayLabel.replace("{n}", String(d.day))}
                {d.title && <span className="font-normal text-ink-2"> · {d.title}</span>}
              </h3>
              {d.steps.length > 0 && (
                <ul className="mt-3 grid gap-2.5">
                  {d.steps.map((s, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 text-[0.93rem] leading-snug text-ink-2"
                    >
                      {s.time ? (
                        <span className="tabular mt-[1px] inline-flex min-w-[66px] shrink-0 items-center justify-center gap-1 rounded-full bg-paper-2 px-2 py-0.5 text-[0.74rem] font-bold text-ink">
                          <Icon name="clock" className="size-3" />
                          {s.time}
                        </span>
                      ) : (
                        <span
                          aria-hidden
                          className={cx(
                            "mt-[7px] size-1.5 shrink-0 rounded-full bg-primary",
                            // Line up with the text of timed steps on days that have them.
                            d.steps.some((x) => x.time) && "mx-[30px]",
                          )}
                        />
                      )}
                      <span className="min-w-0">{s.text}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}

/** Policy or advice groups; the first `open` groups start expanded. */
export function GroupList({
  groups,
  untitled,
  collapsible = false,
}: {
  groups: Group[];
  untitled: string;
  collapsible?: boolean;
}) {
  if (!collapsible) {
    return (
      <div className="grid gap-5">
        {groups.map((g, i) => (
          <div key={i} className="grid gap-2.5">
            {g.title && (
              <h3 className="text-[0.76rem] font-bold uppercase tracking-[0.12em] text-ink-3">
                {g.title}
              </h3>
            )}
            {g.points.length > 0 && (
              <CheckList items={g.points} tone="primary" columns={g.points.length > 6} />
            )}
            {g.text.map((p, k) => (
              <p key={k} className="text-[0.93rem] text-ink-2">
                {p}
              </p>
            ))}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid divide-y divide-rule overflow-hidden rounded-[14px] border border-rule">
      {groups.map((g, i) => (
        <details key={i} open={i < 2} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 font-semibold text-ink hover:bg-paper-2/60 [&::-webkit-details-marker]:hidden">
            {g.title ?? untitled}
            <Icon
              name="arrowRight"
              className="size-4 shrink-0 rotate-90 text-ink-3 transition-transform group-open:-rotate-90"
            />
          </summary>
          <div className="grid gap-2 px-4 pb-4 text-[0.92rem] text-ink-2">
            {g.points.length > 0 && (
              <ul className="grid list-disc gap-1.5 pl-5 marker:text-ink-3">
                {g.points.map((p, k) => (
                  <li key={k}>{p}</li>
                ))}
              </ul>
            )}
            {g.text.map((p, k) => (
              <p key={k}>{p}</p>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}

/** Small rounded labels (pick-up places, transport). */
export function Chips({ items, icon }: { items: string[]; icon: IconName }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((p) => (
        <li
          key={p}
          className="inline-flex items-center gap-1.5 rounded-full border border-rule bg-card px-3 py-1.5 text-[0.86rem] font-medium text-ink"
        >
          <Icon name={icon} className="size-3.5 text-primary-ink" />
          {p}
        </li>
      ))}
    </ul>
  );
}
