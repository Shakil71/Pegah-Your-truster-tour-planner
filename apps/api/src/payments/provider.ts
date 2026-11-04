/**
 * Payment provider port (ADR-0022). Business rules (what a verified payment
 * does to a booking) live in PaymentService; adapters only talk to providers.
 * Adding a provider = implementing this interface + one config value.
 */

export const PAYMENT_PROVIDER = Symbol("PAYMENT_PROVIDER");

export type ProviderMode = "sandbox" | "live" | "simulator";

export interface SessionRequest {
  /** Our transaction id (the payment's public id). */
  tranId: string;
  amountMinor: bigint;
  currency: string;
  booking: { reference: string; productName: string; productType: "HOTEL" | "TOUR" };
  customer: { name: string; email: string; phone: string };
  urls: { success: string; fail: string; cancel: string; ipn: string };
}

export interface SessionResult {
  sessionKey: string | null;
  redirectUrl: string;
}

/** Outcome as confirmed by the provider server-to-server (never from a browser). */
export interface Verification {
  status: "VALID" | "PENDING" | "FAILED" | "CANCELLED" | "UNKNOWN";
  tranId: string | null;
  valId: string | null;
  amountMinor: bigint | null;
  currency: string | null;
  riskLevel: number | null;
  bankTxnId: string | null;
  method: string | null;
  reason: string | null;
}

export interface PaymentProvider {
  readonly name: "sslcommerz" | "simulator";
  readonly mode: ProviderMode;
  createSession(req: SessionRequest): Promise<SessionResult>;
  /** Validates a callback's validation id with the provider. */
  validate(valId: string): Promise<Verification>;
  /** Looks a transaction up by our id (when callbacks never arrived). */
  queryByTranId(tranId: string): Promise<Verification>;
  /** Callback signature check: true/false, or null when the provider does not sign. */
  verifySignature(fields: Readonly<Record<string, string>>): boolean | null;
}

export class ProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderError";
  }
}

/** Minor units → "1234.50". Integer arithmetic only. */
export function formatDecimal(amountMinor: bigint): string {
  if (amountMinor < 0n) throw new RangeError("Amount must not be negative");
  const whole = amountMinor / 100n;
  const frac = (amountMinor % 100n).toString().padStart(2, "0");
  return `${whole}.${frac}`;
}

/** "1234", "1234.5", "1234.50" → minor units; anything else → null. No floats. */
export function parseDecimal(value: unknown): bigint | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  const m = /^(\d{1,15})(?:\.(\d{1,2}))?$/.exec(text);
  if (!m) return null;
  return BigInt(m[1]!) * 100n + BigInt((m[2] ?? "0").padEnd(2, "0"));
}

export const UNKNOWN: Verification = {
  status: "UNKNOWN",
  tranId: null,
  valId: null,
  amountMinor: null,
  currency: null,
  riskLevel: null,
  bankTxnId: null,
  method: null,
  reason: null,
};
