import { Icon, cx, type IconName } from "@pegah/ui";

const META: Record<string, { label: string; icon: IconName; tone: string }> = {
  PENDING_PAYMENT: { label: "Awaiting payment", icon: "clock", tone: "bg-warn-soft text-warn" },
  PAID: { label: "Paid", icon: "check", tone: "bg-good-soft text-good" },
  CANCELLED: { label: "Cancelled", icon: "x", tone: "bg-critical-soft text-critical" },
  EXPIRED: { label: "Expired", icon: "clock", tone: "bg-paper-2 text-ink-2" },
  ACTIVE: { label: "Active", icon: "check", tone: "bg-good-soft text-good" },
  VOID: { label: "Void", icon: "x", tone: "bg-critical-soft text-critical" },
};

/** Order and gift card status: icon + label + reserved colour (ADR-0032). */
export function OrderPill({ status }: { status: string }) {
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
