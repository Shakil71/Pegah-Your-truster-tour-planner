/** Badge colours for visa and flight request statuses (design tokens only). */
export const REQUEST_STATUS_TONE: Record<string, string> = {
  SUBMITTED: "bg-paper-2 text-ink-2",
  NEEDS_INFO: "bg-warn-soft text-warn",
  QUOTED: "bg-primary-soft text-primary-ink",
  PAID: "bg-good-soft text-good",
  IN_PROGRESS: "bg-good-soft text-good",
  COMPLETED: "bg-good-soft text-good",
  REJECTED: "bg-critical-soft text-critical",
  CANCELLED: "bg-paper-2 text-ink-3",
};
