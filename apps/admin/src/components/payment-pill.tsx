import type { PaymentStatus } from "@pegah/contracts";
import { Icon, cx, type IconName } from "@pegah/ui";

const META: Record<PaymentStatus, { label: string; icon: IconName; tone: string }> = {
  INITIATED: { label: "Started", icon: "clock", tone: "bg-paper-2 text-ink-2" },
  PENDING: { label: "On payment page", icon: "clock", tone: "bg-info-soft text-info" },
  SUCCEEDED: { label: "Paid (verified)", icon: "check", tone: "bg-good-soft text-good" },
  FAILED: { label: "Failed", icon: "x", tone: "bg-paper-2 text-ink-3" },
  CANCELLED: { label: "Cancelled", icon: "x", tone: "bg-paper-2 text-ink-3" },
  REFUND_REQUIRED: {
    label: "Refund required",
    icon: "refund",
    tone: "bg-critical-soft text-critical",
  },
};

/** Icon + label + reserved colour; never colour alone. */
export function PaymentPill({ status }: { status: PaymentStatus }) {
  const m = META[status];
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
