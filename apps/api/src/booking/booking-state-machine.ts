import type { BookingStatus } from "@pegah/contracts";

export type BookingActor = "CUSTOMER" | "STAFF" | "SYSTEM" | "PAYMENT_PROVIDER";

/**
 * The booking lifecycle (docs/database/DATABASE_DESIGN.md). Each edge lists
 * which actors may take it. Anything not listed is rejected.
 *
 * Notable rules:
 *  - CONFIRMED is reached only from PAYMENT_PROCESSING (payment provider, after
 *    a verified webhook) or from MANUAL_REVIEW (staff, after checking the
 *    supplier/payment). Nobody can jump straight to CONFIRMED.
 *  - Customers can only request cancellation; staff decide it.
 */
const EDGES: Record<BookingStatus, Partial<Record<BookingStatus, readonly BookingActor[]>>> = {
  DRAFT: {
    PENDING_AVAILABILITY: ["CUSTOMER", "SYSTEM"],
    EXPIRED: ["SYSTEM"],
  },
  PENDING_AVAILABILITY: {
    PENDING_PAYMENT: ["SYSTEM"],
    FAILED: ["SYSTEM"],
  },
  PENDING_PAYMENT: {
    PAYMENT_PROCESSING: ["CUSTOMER", "SYSTEM"],
    EXPIRED: ["SYSTEM"],
    CANCELLED: ["CUSTOMER", "STAFF"],
  },
  PAYMENT_PROCESSING: {
    CONFIRMED: ["PAYMENT_PROVIDER"],
    FAILED: ["PAYMENT_PROVIDER", "SYSTEM"],
    MANUAL_REVIEW: ["PAYMENT_PROVIDER", "SYSTEM"],
  },
  MANUAL_REVIEW: {
    CONFIRMED: ["STAFF"],
    REFUND_PENDING: ["STAFF"],
    FAILED: ["STAFF"],
  },
  CONFIRMED: {
    COMPLETED: ["SYSTEM", "STAFF"],
    CANCELLATION_REQUESTED: ["CUSTOMER", "STAFF"],
  },
  CANCELLATION_REQUESTED: {
    CANCELLED: ["STAFF"],
    CONFIRMED: ["STAFF"],
  },
  CANCELLED: {
    REFUND_PENDING: ["STAFF", "SYSTEM"],
  },
  REFUND_PENDING: {
    REFUNDED: ["STAFF", "PAYMENT_PROVIDER"],
  },
  COMPLETED: {},
  FAILED: {},
  EXPIRED: {},
  REFUNDED: {},
};

export const TERMINAL_STATUSES: readonly BookingStatus[] = (
  Object.keys(EDGES) as BookingStatus[]
).filter((s) => Object.keys(EDGES[s]).length === 0);

export function canTransition(
  from: BookingStatus,
  to: BookingStatus,
  actor: BookingActor,
): boolean {
  return EDGES[from][to]?.includes(actor) ?? false;
}

/** Statuses `actor` may move a booking to from `from`. */
export function allowedTransitions(from: BookingStatus, actor: BookingActor): BookingStatus[] {
  return (Object.entries(EDGES[from]) as [BookingStatus, readonly BookingActor[]][])
    .filter(([, actors]) => actors.includes(actor))
    .map(([to]) => to);
}

export class IllegalTransitionError extends Error {
  constructor(
    readonly from: BookingStatus,
    readonly to: BookingStatus,
    readonly actor: BookingActor,
  ) {
    super(`${actor} cannot move a booking from ${from} to ${to}`);
    this.name = "IllegalTransitionError";
  }
}

export function assertTransition(
  from: BookingStatus,
  to: BookingStatus,
  actor: BookingActor,
): void {
  if (!canTransition(from, to, actor)) throw new IllegalTransitionError(from, to, actor);
}
