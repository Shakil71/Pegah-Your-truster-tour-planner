import bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";
import type { AppConfig } from "../config/config";
import { PasswordService, isLegacyBcrypt } from "./password.service";

const svc = new PasswordService({
  ARGON2_MEMORY_KIB: 8192,
  ARGON2_TIME_COST: 2,
  ARGON2_PARALLELISM: 1,
} as AppConfig);

describe("PasswordService with old-website hashes (ADR-0038)", () => {
  // Laravel writes $2y$; bcryptjs writes $2b$ (same algorithm).
  const laravel = bcrypt.hashSync("old-site-pass", 4).replace(/^\$2b\$/, "$2y$");

  it("accepts the right password for a Laravel bcrypt hash and asks for an upgrade", async () => {
    expect(isLegacyBcrypt(laravel)).toBe(true);
    expect(await svc.verify(laravel, "old-site-pass")).toBe(true);
    expect(await svc.verify(laravel, "wrong")).toBe(false);
    expect(svc.needsRehash(laravel)).toBe(true);
  });

  it("keeps Argon2id as the normal path and never accepts placeholder hashes", async () => {
    const modern = await svc.hash("new-pass");
    expect(isLegacyBcrypt(modern)).toBe(false);
    expect(await svc.verify(modern, "new-pass")).toBe(true);
    expect(svc.needsRehash(modern)).toBe(false);
    expect(await svc.verify("!legacy-no-password", "")).toBe(false);
    expect(await svc.verify("!legacy-no-password", "!legacy-no-password")).toBe(false);
  });
});
