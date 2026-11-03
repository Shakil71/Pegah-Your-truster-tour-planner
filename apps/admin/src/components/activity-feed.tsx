import { Icon, cx, type IconName } from "@pegah/ui";

const tones = {
  good: "bg-good-soft text-good",
  info: "bg-info-soft text-info",
  warn: "bg-warn-soft text-warn",
  neutral: "bg-paper-2 text-ink-2",
} as const;

export function ActivityFeed({
  items,
}: {
  items: Array<{ icon: IconName; tone: keyof typeof tones; text: string; ago: string }>;
}) {
  return (
    <section
      className="panel animate-rise p-5 md:p-6"
      aria-labelledby="act-h"
      style={{ animationDelay: "540ms" }}
    >
      <div className="flex items-center justify-between">
        <h2 id="act-h" className="text-[0.95rem] font-semibold">
          Live activity
        </h2>
        <span className="flex items-center gap-1.5 text-[0.72rem] font-semibold text-good">
          <span className="relative flex size-2">
            <span className="animate-ping-soft absolute inline-flex size-full rounded-full bg-good" />
            <span className="relative inline-flex size-2 rounded-full bg-good" />
          </span>
          Live
        </span>
      </div>
      <ol className="relative mt-5 grid gap-5 before:absolute before:bottom-2 before:left-[15px] before:top-2 before:w-px before:bg-[linear-gradient(180deg,var(--pg-rule)_0_6px,transparent_6px_10px)] before:bg-[length:1px_10px]">
        {items.map((a) => (
          <li key={a.text} className="relative grid grid-cols-[32px_minmax(0,1fr)] gap-3">
            <span
              className={cx(
                "z-[1] grid size-8 place-items-center rounded-full ring-4 ring-card",
                tones[a.tone],
              )}
            >
              <Icon name={a.icon} className="size-4" />
            </span>
            <div>
              <p className="text-[0.84rem] leading-snug">{a.text}</p>
              <p className="mt-0.5 text-[0.72rem] text-ink-3">{a.ago} ago</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
