import { describe, expect, it } from "vitest";
import { parseIdempotencyKey, requestHash } from "./idempotency.service";

describe("idempotency helpers", () => {
  it("hashes request bodies independent of key order", () => {
    const a = requestHash({ product: "HOTEL", rooms: 1, contact: { name: "A", email: "a@b.c" } });
    const b = requestHash({ contact: { email: "a@b.c", name: "A" }, rooms: 1, product: "HOTEL" });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("distinguishes different bodies and array order", () => {
    expect(requestHash({ guests: ["A", "B"] })).not.toBe(requestHash({ guests: ["B", "A"] }));
    expect(requestHash({ rooms: 1 })).not.toBe(requestHash({ rooms: 2 }));
  });

  it("requires a 16–128 character visible key", () => {
    expect(parseIdempotencyKey("3f2b9c1e-8d4a-4f6b-9a1c-2e7d5b8c0f13")).toHaveLength(36);
    expect(() => parseIdempotencyKey(undefined)).toThrow();
    expect(() => parseIdempotencyKey("short")).toThrow();
    expect(() => parseIdempotencyKey("has spaces in the key value")).toThrow();
    expect(() => parseIdempotencyKey("x".repeat(129))).toThrow();
  });
});
