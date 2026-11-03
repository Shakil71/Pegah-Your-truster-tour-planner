import { Icon, cx, type IconName } from "@pegah/ui";
import type { BookingStatus } from "@/data/sample";

/** Status = icon + label + reserved colour; never colour alone. */
export const statusMeta: Record<BookingStatus, { label: string; icon: IconName; tone: string }> = {
  PENDING_PAYMENT: { label: "Pending payment", icon: "clock", tone: "bg-warn-soft text-warn" },
  PAYMENT_PROCESSING: { label: "Processing", icon: "card", tone: "bg-info-soft text-info" },
  CONFIRMED: { label: "Confirmed", icon: "check", tone: "bg-good-soft text-good" },
  MANUAL_REVIEW: { label: "Manual review", icon: "alert", tone: "bg-critical-soft text-critical" },
  CANCELLATION_REQUESTED: { label: "Cancel requested", icon: "x", tone: "bg-warn-soft text-warn" },
  REFUND_PENDING: { label: "Refund pending", icon: "refund", tone: "bg-info-soft text-info" },
  COMPLETED: { label: "Completed", icon: "check", tone: "bg-paper-2 text-ink-2" },
  EXPIRED: { label: "Expired", icon: "clock", tone: "bg-paper-2 text-ink-3" },
};

export function StatusPill({ status, className }: { status: BookingStatus; className?: string }) {
  const m = statusMeta[status];
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[0.74rem] font-semibold",
        m.tone,
        className,
      )}
    >
      <Icon name={m.icon} className="size-3.5" />
      {m.label}
    </span>
  );
}
