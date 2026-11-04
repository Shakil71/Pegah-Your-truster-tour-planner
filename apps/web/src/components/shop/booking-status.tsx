import type { BookingStatus } from "@pegah/contracts";
import { Icon, cx, type IconName } from "@pegah/ui";

/** Customer-facing wording. "Confirmed" appears only for CONFIRMED / COMPLETED. */
const META: Record<BookingStatus, { label: string; icon: IconName; tone: string }> = {
  DRAFT: { label: "Draft", icon: "doc", tone: "bg-paper-2 text-ink-2" },
  PENDING_AVAILABILITY: {
    label: "Checking availability",
    icon: "clock",
    tone: "bg-info-soft text-info",
  },
  PENDING_PAYMENT: {
    label: "Held · awaiting payment",
    icon: "clock",
    tone: "bg-warn-soft text-warn",
  },
  PAYMENT_PROCESSING: { label: "Payment processing", icon: "card", tone: "bg-info-soft text-info" },
  CONFIRMED: { label: "Confirmed", icon: "check", tone: "bg-good-soft text-good" },
  COMPLETED: { label: "Completed", icon: "check", tone: "bg-paper-2 text-ink-2" },
  FAILED: { label: "Not completed", icon: "x", tone: "bg-critical-soft text-critical" },
  EXPIRED: { label: "Hold expired", icon: "clock", tone: "bg-paper-2 text-ink-3" },
  MANUAL_REVIEW: {
    label: "Being checked by our team",
    icon: "alert",
    tone: "bg-info-soft text-info",
  },
  CANCELLATION_REQUESTED: {
    label: "Cancellation requested",
    icon: "x",
    tone: "bg-warn-soft text-warn",
  },
  CANCELLED: { label: "Cancelled", icon: "x", tone: "bg-paper-2 text-ink-3" },
  REFUND_PENDING: { label: "Refund in progress", icon: "refund", tone: "bg-info-soft text-info" },
  REFUNDED: { label: "Refunded", icon: "refund", tone: "bg-paper-2 text-ink-2" },
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const m = META[status];
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-[0.8rem] font-semibold",
        m.tone,
      )}
    >
      <Icon name={m.icon} className="size-4" />
      {m.label}
    </span>
  );
}
