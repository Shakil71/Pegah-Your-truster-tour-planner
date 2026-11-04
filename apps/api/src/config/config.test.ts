import { describe, expect, it } from "vitest";
import { loadConfig } from "./config";

const base = {
  DATABASE_URL: "mysql://app@127.0.0.1:3306/pegah",
  SESSION_SECRET: "x".repeat(40),
};

describe("loadConfig", () => {
  it("applies safe defaults", () => {
    const c = loadConfig({ ...base });
    expect(c.PORT).toBe(4000);
    expect(c.HOST).toBe("127.0.0.1");
    expect(c.COOKIE_SECURE).toBe(false);
    expect(c.APP_ORIGINS).toEqual(["http://localhost:3000", "http://localhost:3001"]);
    expect(c.STAFF_SESSION_IDLE_MIN).toBeLessThan(c.CUSTOMER_SESSION_IDLE_MIN);
  });

  it("names missing variables without echoing values", () => {
    const secret = "short-secret-value";
    let message = "";
    try {
      loadConfig({ DATABASE_URL: "postgres://nope", SESSION_SECRET: secret });
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toContain("DATABASE_URL");
    expect(message).toContain("SESSION_SECRET");
    expect(message).not.toContain(secret);
  });

  it("refuses insecure production settings", () => {
    expect(() => loadConfig({ ...base, NODE_ENV: "production" })).toThrow(/COOKIE_SECURE/);
    expect(() =>
      loadConfig({
        ...base,
        NODE_ENV: "production",
        COOKIE_SECURE: "true",
        OPENAPI_ENABLED: "true",
      }),
    ).toThrow(/OPENAPI_ENABLED/);
    expect(
      loadConfig({ ...base, NODE_ENV: "production", COOKIE_SECURE: "true" }).COOKIE_SECURE,
    ).toBe(true);
  });

  it("keeps payments off by default and guards every way of turning them on", () => {
    expect(loadConfig({ ...base }).PAYMENT_PROVIDER).toBe("none");
    const prod = { ...base, NODE_ENV: "production", COOKIE_SECURE: "true" };
    expect(() => loadConfig({ ...prod, PAYMENT_PROVIDER: "simulator" })).toThrow(/simulator/);
    expect(() =>
      loadConfig({
        ...prod,
        PAYMENT_PROVIDER: "sslcommerz",
        PUBLIC_BASE_URL: "http://plain.example",
        SSLCOMMERZ_STORE_ID: "x",
        SSLCOMMERZ_STORE_PASSWORD: "y",
      }),
    ).toThrow(/https/);
    expect(() =>
      loadConfig({ ...base, PAYMENT_PROVIDER: "sslcommerz", PUBLIC_BASE_URL: "https://a.example" }),
    ).toThrow(/STORE_ID/);
    expect(() =>
      loadConfig({
        ...base,
        PAYMENT_PROVIDER: "sslcommerz",
        PUBLIC_BASE_URL: "https://a.example",
        SSLCOMMERZ_STORE_ID: "x",
        SSLCOMMERZ_STORE_PASSWORD: "y",
        SSLCOMMERZ_MODE: "live",
      }),
    ).toThrow(/LIVE_APPROVED/);
    expect(
      loadConfig({
        ...base,
        PAYMENT_PROVIDER: "sslcommerz",
        PUBLIC_BASE_URL: "https://a.example",
        SSLCOMMERZ_STORE_ID: "x",
        SSLCOMMERZ_STORE_PASSWORD: "y",
      }).SSLCOMMERZ_MODE,
    ).toBe("sandbox");
  });
});
