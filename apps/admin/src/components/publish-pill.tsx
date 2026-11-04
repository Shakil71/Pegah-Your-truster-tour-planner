import { Icon, cx, type IconName } from "@pegah/ui";

const META: Record<string, { label: string; icon: IconName; tone: string }> = {
  PUBLISHED: { label: "Live on site", icon: "check", tone: "bg-good-soft text-good" },
  DRAFT: { label: "Draft", icon: "doc", tone: "bg-paper-2 text-ink-2" },
  SUSPENDED: { label: "Suspended", icon: "alert", tone: "bg-warn-soft text-warn" },
  SCHEDULED: { label: "On sale", icon: "check", tone: "bg-good-soft text-good" },
  CLOSED: { label: "Closed", icon: "clock", tone: "bg-paper-2 text-ink-2" },
  CANCELLED: { label: "Cancelled", icon: "x", tone: "bg-critical-soft text-critical" },
};

/** Catalog publish / departure status: icon + label + reserved colour. */
export function PublishPill({ status }: { status: string }) {
  const m = META[status] ?? {
    label: status,
    icon: "doc" as IconName,
    tone: "bg-paper-2 text-ink-2",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[0.74rem] font-semibold",
        m.tone,
      )}
    >
      <Icon name={m.icon} className="size-3.5" />
      {m.label}
    </span>
  );
}
