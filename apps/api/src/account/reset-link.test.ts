import { describe, expect, it } from "vitest";
import { resetLink } from "./account.service";

describe("resetLink", () => {
  const base = "https://pegah.com.bd";
  it("opens where each kind of account signs in", () => {
    expect(resetLink(base, "CUSTOMER", "abc")).toBe(
      "https://pegah.com.bd/reset-password?token=abc",
    );
    expect(resetLink(base, "STAFF", "abc")).toBe(
      "https://pegah.com.bd/admin/reset-password?token=abc",
    );
    expect(resetLink(base, "PARTNER", "abc")).toBe(
      "https://pegah.com.bd/reset-password?token=abc&for=partner",
    );
  });
});
