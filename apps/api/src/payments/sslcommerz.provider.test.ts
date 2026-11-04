import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { formatDecimal, parseDecimal, type SessionRequest } from "./provider";
import { SslcommerzProvider, mapSslcommerzRecord, type FetchLike } from "./sslcommerz.provider";

const md5 = (s: string) => createHash("md5").update(s).digest("hex");

const request: SessionRequest = {
  tranId: "01JC0000000000000000000PAY",
  amountMinor: 2_150_550n,
  currency: "BDT",
  booking: { reference: "PG-7K3QX9", productName: "Tea Garden Resort", productType: "HOTEL" },
  customer: { name: "Nusrat Jahan", email: "nusrat@example.com", phone: "+8801711000000" },
  urls: {
    success: "https://pegah.example/api/v1/payments/sslcommerz/return/success",
    fail: "https://pegah.example/api/v1/payments/sslcommerz/return/fail",
    cancel: "https://pegah.example/api/v1/payments/sslcommerz/return/cancel",
    ipn: "https://pegah.example/api/v1/payments/sslcommerz/ipn",
  },
};

function fakeFetch(response: unknown, calls: { url: string; init?: RequestInit }[]): FetchLike {
  return async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
}

function provider(fetch: FetchLike, mode: "sandbox" | "live" = "sandbox") {
  return new SslcommerzProvider({
    storeId: "teststore",
    storePassword: "test-secret",
    mode,
    productProfile: "non-physical-goods",
    fetch,
  });
}

describe("money for SSLCOMMERZ", () => {
  it("formats and parses decimal strings without floats", () => {
    expect(formatDecimal(2_150_550n)).toBe("21505.50");
    expect(formatDecimal(5n)).toBe("0.05");
    expect(parseDecimal("21505.50")).toBe(2_150_550n);
    expect(parseDecimal("21505.5")).toBe(2_150_550n);
    expect(parseDecimal("21505")).toBe(2_150_500n);
    expect(parseDecimal("21,505.50")).toBeNull();
    expect(parseDecimal("1e5")).toBeNull();
    expect(parseDecimal("-3.00")).toBeNull();
    expect(parseDecimal("1.234")).toBeNull();
  });
});

describe("SslcommerzProvider", () => {
  it("opens a sandbox session with the documented form fields", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const p = provider(
      fakeFetch(
        {
          status: "SUCCESS",
          sessionkey: "ABC123",
          GatewayPageURL: "https://sandbox.sslcommerz.com/EasyCheckOut/testcde",
        },
        calls,
      ),
    );
    const session = await p.createSession(request);
    expect(session).toEqual({
      sessionKey: "ABC123",
      redirectUrl: "https://sandbox.sslcommerz.com/EasyCheckOut/testcde",
    });
    expect(calls[0]!.url).toBe("https://sandbox.sslcommerz.com/gwprocess/v4/api.php");
    const form = new URLSearchParams(String(calls[0]!.init!.body));
    expect(Object.fromEntries(form)).toMatchObject({
      store_id: "teststore",
      total_amount: "21505.50",
      currency: "BDT",
      tran_id: request.tranId,
      success_url: request.urls.success,
      ipn_url: request.urls.ipn,
      cus_email: "nusrat@example.com",
      shipping_method: "NO",
      product_profile: "non-physical-goods",
      value_a: "PG-7K3QX9",
    });
  });

  it("uses the live host only in live mode", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    await provider(
      fakeFetch({ status: "SUCCESS", GatewayPageURL: "https://securepay.sslcommerz.com/x" }, calls),
      "live",
    ).createSession(request);
    expect(calls[0]!.url.startsWith("https://securepay.sslcommerz.com/")).toBe(true);
  });

  it("reports a refused session without leaking the store password", async () => {
    const p = provider(fakeFetch({ status: "FAILED", failedreason: "Store Credential Error" }, []));
    await expect(p.createSession(request)).rejects.toThrow(/Store Credential Error/);
    const down = new SslcommerzProvider({
      storeId: "teststore",
      storePassword: "test-secret",
      mode: "sandbox",
      productProfile: "general",
      fetch: async () => {
        throw new Error("connect ECONNREFUSED https://sandbox?store_passwd=test-secret");
      },
    });
    const error = await down.validate("x").catch((e: Error) => e);
    expect(String(error)).not.toContain("test-secret");
  });

  it("refuses non-BDT sessions (only BDT is enabled)", () => {
    expect(() =>
      provider(fakeFetch({}, [])).sessionFields({ ...request, currency: "USD" }),
    ).toThrow();
  });

  it("maps a validation response, preferring the original currency amount", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const v = await provider(
      fakeFetch(
        {
          status: "VALID",
          tran_id: request.tranId,
          val_id: "230101123456ABC",
          amount: "21505.50",
          currency: "BDT",
          currency_type: "BDT",
          currency_amount: "21505.50",
          bank_tran_id: "2301011234567",
          card_type: "VISA-Dutch Bangla",
          card_brand: "VISA",
          risk_level: "0",
        },
        calls,
      ),
    ).validate("230101123456ABC");
    expect(calls[0]!.url).toContain(
      "/validator/api/validationserverAPI.php?val_id=230101123456ABC",
    );
    expect(v).toMatchObject({
      status: "VALID",
      tranId: request.tranId,
      amountMinor: 2_150_550n,
      currency: "BDT",
      riskLevel: 0,
      method: "VISA",
    });
  });

  it("treats VALIDATED as valid and other statuses conservatively", () => {
    expect(mapSslcommerzRecord({ status: "VALIDATED" }).status).toBe("VALID");
    expect(mapSslcommerzRecord({ status: "INVALID_TRANSACTION" }).status).toBe("FAILED");
    expect(mapSslcommerzRecord({ status: "CANCELLED" }).status).toBe("CANCELLED");
    expect(mapSslcommerzRecord({ status: "UNATTEMPTED" }).status).toBe("PENDING");
    expect(mapSslcommerzRecord({ status: "SOMETHING_NEW" }).status).toBe("UNKNOWN");
    expect(mapSslcommerzRecord({ status: "VALID", risk_level: "1" }).riskLevel).toBe(1);
  });

  it("looks up by transaction id and prefers a valid attempt", async () => {
    const v = await provider(
      fakeFetch(
        {
          APIConnect: "DONE",
          no_of_trans_found: 2,
          element: [
            { status: "FAILED", tran_id: request.tranId },
            {
              status: "VALID",
              tran_id: request.tranId,
              val_id: "V2",
              amount: "21505.50",
              currency: "BDT",
            },
          ],
        },
        [],
      ),
    ).queryByTranId(request.tranId);
    expect(v).toMatchObject({ status: "VALID", valId: "V2" });
    const none = await provider(
      fakeFetch({ APIConnect: "DONE", no_of_trans_found: 0 }, []),
    ).queryByTranId("T");
    expect(none.status).toBe("PENDING");
  });

  it("verifies callback signatures as documented and rejects tampering", () => {
    const p = provider(fakeFetch({}, []));
    const fields: Record<string, string> = {
      tran_id: request.tranId,
      val_id: "V1",
      amount: "21505.50",
      status: "VALID",
      verify_key: "amount,status,tran_id,val_id",
    };
    const text = `amount=21505.50&status=VALID&store_passwd=${md5("test-secret")}&tran_id=${request.tranId}&val_id=V1`;
    fields.verify_sign = md5(text);
    expect(p.verifySignature(fields)).toBe(true);
    expect(p.verifySignature({ ...fields, amount: "1.00" })).toBe(false);
    expect(p.verifySignature({ tran_id: "x" })).toBeNull();
  });
});
