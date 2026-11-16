import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-path";

describe("safeRedirectPath", () => {
  it("keeps paths on this site", () => {
    expect(safeRedirectPath("/account/bookings?x=1#a", "/")).toBe("/account/bookings?x=1#a");
    expect(safeRedirectPath("/gift-cards?card=coxs-sunset#buy", "/")).toBe(
      "/gift-cards?card=coxs-sunset#buy",
    );
  });

  it("refuses anything that leaves the site", () => {
    for (const bad of [
      "//evil.com",
      "/\\evil.com",
      "/\\/evil.com",
      "https://evil.com",
      "javascript:alert(1)",
      "/\t/evil.com",
      "/\n/evil.com",
      " /x",
      "evil.com",
      "",
      undefined,
      null,
    ]) {
      expect(safeRedirectPath(bad, "/home")).toBe("/home");
    }
  });
});
