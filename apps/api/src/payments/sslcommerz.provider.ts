import { createHash } from "node:crypto";
import {
  ProviderError,
  UNKNOWN,
  formatDecimal,
  parseDecimal,
  type PaymentProvider,
  type SessionRequest,
  type SessionResult,
  type Verification,
} from "./provider";

/**
 * SSLCOMMERZ hosted checkout, API v4 (developer.sslcommerz.com).
 *
 * STATUS: written against the published documentation and unit-tested with
 * recorded response shapes. NOT yet verified against the real sandbox, because
 * Pegah has no sandbox credentials. Complete the checklist in
 * docs/operations/SSLCOMMERZ_INTEGRATION.md before enabling it anywhere.
 *
 *  - Session:    POST {base}/gwprocess/v4/api.php (form-urlencoded)
 *  - Validation: GET  {base}/validator/api/validationserverAPI.php?val_id=…
 *  - By tran_id: GET  {base}/validator/api/merchantTransIDvalidationAPI.php?tran_id=…
 *  - IPN / return callbacks are POSTed form-urlencoded to our URLs and are
 *    never trusted on their own: every outcome is re-checked with the
 *    validation API before it changes a booking.
 */

const BASE = {
  sandbox: "https://sandbox.sslcommerz.com",
  live: "https://securepay.sslcommerz.com",
} as const;

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export interface SslcommerzOptions {
  storeId: string;
  storePassword: string;
  mode: "sandbox" | "live";
  productProfile: "general" | "non-physical-goods" | "travel-vertical";
  fetch?: FetchLike;
  timeoutMs?: number;
}

const md5 = (s: string) => createHash("md5").update(s).digest("hex");
const str = (v: unknown): string | null =>
  typeof v === "string" && v.length > 0 ? v : typeof v === "number" ? String(v) : null;

/** Maps an SSLCOMMERZ transaction record (validation or query API) to a Verification. */
export function mapSslcommerzRecord(r: Record<string, unknown>): Verification {
  const raw = (str(r.status) ?? "").toUpperCase();
  const status: Verification["status"] =
    raw === "VALID" || raw === "VALIDATED"
      ? "VALID"
      : raw === "PENDING" || raw === "UNATTEMPTED"
        ? "PENDING"
        : raw === "CANCELLED"
          ? "CANCELLED"
          : raw === "FAILED" || raw === "EXPIRED" || raw === "INVALID_TRANSACTION"
            ? "FAILED"
            : "UNKNOWN";
  // currency_type/currency_amount carry the original (requested) currency and
  // amount when SSLCOMMERZ converts; fall back to currency/amount.
  const currency = str(r.currency_type) ?? str(r.currency);
  const amount = parseDecimal(r.currency_amount ?? r.amount);
  const risk = str(r.risk_level);
  return {
    status,
    tranId: str(r.tran_id),
    valId: str(r.val_id),
    amountMinor: amount,
    currency: currency ? currency.toUpperCase() : null,
    riskLevel: risk !== null && /^\d+$/.test(risk) ? Number(risk) : null,
    bankTxnId: str(r.bank_tran_id),
    method: str(r.card_brand) ?? str(r.card_type),
    reason:
      str(r.error) ??
      str(r.failedreason) ??
      (status === "UNKNOWN" ? `status ${raw || "missing"}` : null),
  };
}

export class SslcommerzProvider implements PaymentProvider {
  readonly name = "sslcommerz" as const;
  readonly mode: "sandbox" | "live";
  private readonly base: string;
  private readonly fetch: FetchLike;
  private readonly timeoutMs: number;

  constructor(private readonly options: SslcommerzOptions) {
    this.mode = options.mode;
    this.base = BASE[options.mode];
    this.fetch = options.fetch ?? ((url, init) => fetch(url, init));
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  /** Form fields for the session API. Exposed for tests; contains the store password. */
  sessionFields(req: SessionRequest): Record<string, string> {
    if (req.currency !== "BDT") throw new ProviderError("Only BDT is enabled for SSLCOMMERZ");
    const fields: Record<string, string> = {
      store_id: this.options.storeId,
      store_passwd: this.options.storePassword,
      total_amount: formatDecimal(req.amountMinor),
      currency: req.currency,
      tran_id: req.tranId,
      success_url: req.urls.success,
      fail_url: req.urls.fail,
      cancel_url: req.urls.cancel,
      ipn_url: req.urls.ipn,
      cus_name: req.customer.name.slice(0, 50),
      cus_email: req.customer.email.slice(0, 50),
      cus_phone: req.customer.phone.slice(0, 20),
      cus_add1: "Bangladesh",
      cus_city: "Dhaka",
      cus_country: "Bangladesh",
      shipping_method: "NO",
      num_of_item: "1",
      product_name: `${req.booking.reference} ${req.booking.productName}`.slice(0, 255),
      product_category: req.booking.productType === "HOTEL" ? "Hotel" : "Tour",
      product_profile: this.options.productProfile,
      // Echoed back on callbacks; lets support match a payment to a booking.
      value_a: req.booking.reference,
    };
    return fields;
  }

  async createSession(req: SessionRequest): Promise<SessionResult> {
    const body = new URLSearchParams(this.sessionFields(req));
    const json = await this.call(`${this.base}/gwprocess/v4/api.php`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    if (str(json.status)?.toUpperCase() !== "SUCCESS" || !str(json.GatewayPageURL)) {
      throw new ProviderError(
        `SSLCOMMERZ session refused: ${str(json.failedreason) ?? str(json.status) ?? "no reason"}`,
      );
    }
    const redirectUrl = str(json.GatewayPageURL)!;
    if (!redirectUrl.startsWith("https://")) throw new ProviderError("Gateway URL is not https");
    return { sessionKey: str(json.sessionkey), redirectUrl };
  }

  async validate(valId: string): Promise<Verification> {
    const q = new URLSearchParams({
      val_id: valId,
      store_id: this.options.storeId,
      store_passwd: this.options.storePassword,
      format: "json",
      v: "1",
    });
    const json = await this.call(`${this.base}/validator/api/validationserverAPI.php?${q}`);
    return mapSslcommerzRecord(json);
  }

  async queryByTranId(tranId: string): Promise<Verification> {
    const q = new URLSearchParams({
      tran_id: tranId,
      store_id: this.options.storeId,
      store_passwd: this.options.storePassword,
      format: "json",
    });
    const json = await this.call(
      `${this.base}/validator/api/merchantTransIDvalidationAPI.php?${q}`,
    );
    const elements = Array.isArray(json.element) ? (json.element as Record<string, unknown>[]) : [];
    if (elements.length === 0) return { ...UNKNOWN, tranId, status: "PENDING" };
    const mapped = elements.map(mapSslcommerzRecord);
    // A transaction can have several attempts; any verified success wins.
    return mapped.find((m) => m.status === "VALID") ?? mapped[0]!;
  }

  /**
   * SSLCOMMERZ signs callbacks: verify_key lists the signed fields; the
   * signature is md5 of "k=v&…" over those fields plus store_passwd=md5(password),
   * sorted by key. A valid signature is helpful but not sufficient — the
   * validation API is still called.
   */
  verifySignature(fields: Readonly<Record<string, string>>): boolean | null {
    const sign = fields.verify_sign;
    const keys = fields.verify_key;
    if (!sign || !keys) return null;
    const data: Record<string, string> = { store_passwd: md5(this.options.storePassword) };
    for (const k of keys.split(",")) {
      if (k) data[k] = fields[k] ?? "";
    }
    const text = Object.keys(data)
      .sort()
      .map((k) => `${k}=${data[k]}`)
      .join("&");
    return md5(text) === sign.toLowerCase();
  }

  private async call(url: string, init?: RequestInit): Promise<Record<string, unknown>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetch(url, { ...init, signal: controller.signal });
      if (!res.ok) throw new ProviderError(`SSLCOMMERZ HTTP ${res.status}`);
      const json = (await res.json()) as unknown;
      if (typeof json !== "object" || json === null) throw new ProviderError("Unexpected response");
      return json as Record<string, unknown>;
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      // Never include the URL: it carries the store password.
      throw new ProviderError(
        controller.signal.aborted ? "SSLCOMMERZ timed out" : "SSLCOMMERZ unreachable",
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
