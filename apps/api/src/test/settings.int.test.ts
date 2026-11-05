/* Console Settings page data against MySQL 8.4: permission-gated, read-only,
 * and never contains secret values. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ADMIN_URL, createHarness, type Harness } from "./int-harness";

const STORE_PASSWORD = "store-secret-do-not-leak";
const SMTP_PASSWORD = "smtp-secret-do-not-leak";

describe.skipIf(!ADMIN_URL)("system settings against MySQL 8.4", () => {
  let h: Harness;

  beforeAll(async () => {
    h = await createHarness({
      PAYMENT_PROVIDER: "sslcommerz",
      PUBLIC_BASE_URL: "https://pegah.example",
      SSLCOMMERZ_STORE_ID: "teststore",
      SSLCOMMERZ_STORE_PASSWORD: STORE_PASSWORD,
      EMAIL_TRANSPORT: "smtp",
      SMTP_HOST: "smtp.example.com",
      SMTP_USER: "mailer",
      SMTP_PASSWORD,
    });
  }, 120_000);
  afterAll(() => h?.close());

  it("shows owners what is switched on, without secrets", async () => {
    const owner = await h.staff("owner");
    const res = await h.call("GET", "/admin/settings", { session: owner });
    expect(res.statusCode).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.json()).toMatchObject({
      database: "up",
      payments: {
        provider: "sslcommerz",
        mode: "sandbox",
        liveApproved: false,
        credentialsSet: true,
        publicBaseUrl: "https://pegah.example",
      },
      email: { transport: "smtp", smtpHost: "smtp.example.com", queued: 0, failed: 0 },
      booking: { holdMinutes: 15 },
    });
    expect(res.body).not.toContain(STORE_PASSWORD);
    expect(res.body).not.toContain(SMTP_PASSWORD);
    expect(res.body).not.toContain("mailer");
    expect(res.body).not.toMatch(/mysql:\/\//);
  });

  it("is refused to staff without settings:read", async () => {
    const ops = await h.staff("operations");
    const res = await h.call("GET", "/admin/settings", { session: ops });
    expect(res.statusCode).toBe(403);
    const anonymous = await h.call("GET", "/admin/settings");
    expect(anonymous.statusCode).toBe(401);
  });
});
