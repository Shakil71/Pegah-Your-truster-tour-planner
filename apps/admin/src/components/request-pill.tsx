import { Icon, cx, type IconName } from "@pegah/ui";

export const REQUEST_STATUS: Record<string, { label: string; icon: IconName; tone: string }> = {
  SUBMITTED: { label: "New", icon: "bell", tone: "bg-primary-soft text-primary-ink" },
  NEEDS_INFO: { label: "Waiting for customer", icon: "chat", tone: "bg-warn-soft text-warn" },
  QUOTED: { label: "Quoted · awaiting payment", icon: "clock", tone: "bg-warn-soft text-warn" },
  PAID: { label: "Paid", icon: "check", tone: "bg-good-soft text-good" },
  IN_PROGRESS: { label: "In progress", icon: "pulse", tone: "bg-good-soft text-good" },
  COMPLETED: { label: "Completed", icon: "check", tone: "bg-good-soft text-good" },
  REJECTED: { label: "Rejected", icon: "x", tone: "bg-critical-soft text-critical" },
  CANCELLED: { label: "Cancelled", icon: "x", tone: "bg-paper-2 text-ink-2" },
};

/** Visa/flight request status: icon + label + reserved colour (ADR-0039). */
export function RequestPill({ status }: { status: string }) {
  const m = REQUEST_STATUS[status] ?? {
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
