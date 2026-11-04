import { BOOKING_STATUSES } from "@pegah/contracts";
import { describe, expect, it } from "vitest";
import {
  allowedTransitions,
  assertTransition,
  canTransition,
  IllegalTransitionError,
  TERMINAL_STATUSES,
  type BookingActor,
} from "./booking-state-machine";

const ACTORS: BookingActor[] = ["CUSTOMER", "STAFF", "SYSTEM", "PAYMENT_PROVIDER"];

describe("booking state machine", () => {
  it("walks the happy path", () => {
    expect(canTransition("DRAFT", "PENDING_AVAILABILITY", "CUSTOMER")).toBe(true);
    expect(canTransition("PENDING_AVAILABILITY", "PENDING_PAYMENT", "SYSTEM")).toBe(true);
    expect(canTransition("PENDING_PAYMENT", "PAYMENT_PROCESSING", "CUSTOMER")).toBe(true);
    expect(canTransition("PAYMENT_PROCESSING", "CONFIRMED", "PAYMENT_PROVIDER")).toBe(true);
    expect(canTransition("CONFIRMED", "COMPLETED", "SYSTEM")).toBe(true);
  });

  it("never lets anyone jump straight to CONFIRMED", () => {
    const sources = BOOKING_STATUSES.filter(
      (s) => s !== "PAYMENT_PROCESSING" && s !== "MANUAL_REVIEW" && s !== "CANCELLATION_REQUESTED",
    );
    for (const from of sources) {
      for (const actor of ACTORS) expect(canTransition(from, "CONFIRMED", actor)).toBe(false);
    }
  });

  it("confirms from payment only via the payment provider, and from review only via staff", () => {
    expect(canTransition("PAYMENT_PROCESSING", "CONFIRMED", "STAFF")).toBe(false);
    expect(canTransition("PAYMENT_PROCESSING", "CONFIRMED", "CUSTOMER")).toBe(false);
    expect(canTransition("MANUAL_REVIEW", "CONFIRMED", "STAFF")).toBe(true);
    expect(canTransition("MANUAL_REVIEW", "CONFIRMED", "SYSTEM")).toBe(false);
  });

  it("lets customers request, but not decide, cancellation", () => {
    expect(canTransition("CONFIRMED", "CANCELLATION_REQUESTED", "CUSTOMER")).toBe(true);
    expect(canTransition("CANCELLATION_REQUESTED", "CANCELLED", "CUSTOMER")).toBe(false);
    expect(canTransition("CANCELLATION_REQUESTED", "CANCELLED", "STAFF")).toBe(true);
  });

  it("has no exits from terminal statuses", () => {
    expect([...TERMINAL_STATUSES].sort()).toEqual(
      ["COMPLETED", "EXPIRED", "FAILED", "REFUNDED"].sort(),
    );
    for (const from of TERMINAL_STATUSES) {
      for (const actor of ACTORS) expect(allowedTransitions(from, actor)).toEqual([]);
    }
  });

  it("covers every status in the contract", () => {
    for (const s of BOOKING_STATUSES) expect(() => allowedTransitions(s, "STAFF")).not.toThrow();
  });

  it("lists staff options for a booking in manual review", () => {
    expect(allowedTransitions("MANUAL_REVIEW", "STAFF").sort()).toEqual(
      ["CONFIRMED", "FAILED", "REFUND_PENDING"].sort(),
    );
  });

  it("throws a typed error for illegal moves", () => {
    expect(() => assertTransition("REFUNDED", "CONFIRMED", "STAFF")).toThrow(
      IllegalTransitionError,
    );
    expect(() => assertTransition("DRAFT", "PENDING_AVAILABILITY", "CUSTOMER")).not.toThrow();
  });
});
