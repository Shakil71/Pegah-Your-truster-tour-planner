import {
  UNKNOWN,
  type PaymentProvider,
  type SessionRequest,
  type SessionResult,
  type Verification,
} from "./provider";

type Outcome = "success" | "fail" | "cancel";

/**
 * A stand-in payment page for development and automated tests ONLY. The
 * configuration refuses it in production (config.ts), so it can never confirm
 * a real booking. It exercises exactly the same callback, verification and
 * confirmation code as SSLCOMMERZ.
 */
export class SimulatorProvider implements PaymentProvider {
  readonly name = "simulator" as const;
  readonly mode = "simulator" as const;
  private readonly sessions = new Map<
    string,
    { amountMinor: bigint; currency: string; outcome: Outcome | null; urls: SessionRequest["urls"] }
  >();

  constructor(private readonly publicBaseUrl: string) {}

  async createSession(req: SessionRequest): Promise<SessionResult> {
    this.sessions.set(req.tranId, {
      amountMinor: req.amountMinor,
      currency: req.currency,
      outcome: null,
      urls: req.urls,
    });
    return {
      sessionKey: `SIMSESSION-${req.tranId}`,
      redirectUrl: `${this.publicBaseUrl}/api/v1/payments/simulator/${req.tranId}`,
    };
  }

  has(tranId: string): boolean {
    return this.sessions.has(tranId);
  }

  /**
   * Records what the "customer" did on the simulated page. Tests may pass a
   * different amount to simulate a provider-side mismatch.
   */
  complete(tranId: string, outcome: Outcome, override?: { amountMinor?: bigint }): string | null {
    const s = this.sessions.get(tranId);
    if (!s) return null;
    s.outcome = outcome;
    if (override?.amountMinor !== undefined) s.amountMinor = override.amountMinor;
    return `SIMVAL-${tranId}`;
  }

  async validate(valId: string): Promise<Verification> {
    return this.lookup(valId.replace(/^SIMVAL-/, ""));
  }

  async queryByTranId(tranId: string): Promise<Verification> {
    return this.lookup(tranId);
  }

  verifySignature(): boolean | null {
    return null;
  }

  private lookup(tranId: string): Verification {
    const s = this.sessions.get(tranId);
    if (!s) return { ...UNKNOWN, tranId };
    const status: Verification["status"] =
      s.outcome === "success"
        ? "VALID"
        : s.outcome === "fail"
          ? "FAILED"
          : s.outcome === "cancel"
            ? "CANCELLED"
            : "PENDING";
    return {
      status,
      tranId,
      valId: s.outcome === "success" ? `SIMVAL-${tranId}` : null,
      amountMinor: s.amountMinor,
      currency: s.currency,
      riskLevel: 0,
      bankTxnId: s.outcome === "success" ? `SIMBANK-${tranId.slice(-8)}` : null,
      method: "SIMULATOR",
      reason: null,
    };
  }
}
