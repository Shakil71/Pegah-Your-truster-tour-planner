import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { SecretBox } from "./secret-box";

const key = () => randomBytes(32).toString("base64");

describe("SecretBox", () => {
  it("round-trips a secret and never stores it in clear", () => {
    const box = new SecretBox(key());
    const sealed = box.seal("store-pass-123", "sslcommerz.storePassword");
    expect(sealed).toMatch(/^v1:/);
    expect(sealed).not.toContain("store-pass-123");
    expect(box.open(sealed, "sslcommerz.storePassword")).toBe("store-pass-123");
    // Fresh IV every time.
    expect(box.seal("store-pass-123", "x")).not.toBe(box.seal("store-pass-123", "x"));
  });

  it("refuses another key, another slot, or a tampered value", () => {
    const box = new SecretBox(key());
    const sealed = box.seal("secret", "smtp.password");
    expect(new SecretBox(key()).open(sealed, "smtp.password")).toBeNull();
    expect(box.open(sealed, "sslcommerz.storePassword")).toBeNull();
    const raw = Buffer.from(sealed.slice(3), "base64");
    raw[raw.length - 1] ^= 1;
    expect(box.open(`v1:${raw.toString("base64")}`, "smtp.password")).toBeNull();
  });

  it("rejects keys that are not 32 bytes", () => {
    expect(() => new SecretBox(randomBytes(16).toString("base64"))).toThrow();
  });
});
