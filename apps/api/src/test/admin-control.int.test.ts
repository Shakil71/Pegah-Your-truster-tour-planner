/* Admin control against MySQL 8.4: customer account controls (customer:manage)
 * and console settings with encrypted credentials (ADR-0029). */
import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addDays, dhakaToday, formatCalendarDate } from "../common/time";
import { ADMIN_URL, createHarness, type Harness, type Session } from "./int-harness";

const NO_EMAIL = {
  transport: "none",
  from: "Pegah <no-reply@pegah.example>",
  smtpHost: "",
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: "",
};

describe.skipIf(!ADMIN_URL)("admin control against MySQL 8.4", () => {
  let h: Harness;
  let owner: Session;
  const day = (n: number) => formatCalendarDate(addDays(dhakaToday(), n));

  beforeAll(async () => {
    h = await createHarness({
      PUBLIC_BASE_URL: "https://pegah.example",
      SETTINGS_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
    });
    owner = await h.staff("owner");
  }, 120_000);
  afterAll(() => h?.close());

  async function customerId(email: string): Promise<string> {
    const user = await h.db.user.findUniqueOrThrow({ where: { email } });
    return user.publicId;
  }

  async function hold(session: Session) {
    const q = `roomId=${h.roomId}&checkIn=${day(10)}&checkOut=${day(11)}&adults=1&rooms=1`;
    const total = (await h.call("GET", `/quotes/hotel?${q}`)).json().price.total;
    const res = await h.call("POST", "/bookings", {
      session,
      headers: { "idempotency-key": randomUUID() },
      body: {
        product: "HOTEL",
        roomId: h.roomId,
        checkIn: day(10),
        checkOut: day(11),
        rooms: 1,
        adults: 1,
        children: 0,
        contact: { name: "Rina Akter", email: "rina@example.com", phone: "+8801711000000" },
        guests: [{ fullName: "Rina Akter", ageGroup: "ADULT" }],
        expectedTotal: total,
      },
    });
    expect(res.statusCode).toBe(201);
    return res.json() as { id: string; holdExpiresAt: string; canPay: boolean };
  }

  // ── Customers ──────────────────────────────────────────────────────────────

  it("disables a customer with a reason, signing them out, and enables them again", async () => {
    const email = "disable-me@example.com";
    const customer = await h.register(email);
    const id = await customerId(email);

    const noReason = await h.call("PATCH", `/admin/customers/${id}`, {
      session: owner,
      body: { status: "DISABLED" },
    });
    expect(noReason.statusCode).toBe(422);

    const off = await h.call("PATCH", `/admin/customers/${id}`, {
      session: owner,
      body: { status: "DISABLED", reason: "Chargeback fraud report" },
    });
    expect(off.statusCode).toBe(200);
    expect(off.json().status).toBe("DISABLED");
    // Their session ends at once and they cannot sign in again.
    expect((await h.call("GET", "/auth/session", { session: customer })).statusCode).toBe(401);
    const login = await h.call("POST", "/auth/login", {
      body: { email, password: "correct-horse-battery" },
    });
    expect(login.statusCode).toBe(401);

    const on = await h.call("PATCH", `/admin/customers/${id}`, {
      session: owner,
      body: { status: "ACTIVE" },
    });
    expect(on.json().status).toBe("ACTIVE");
    const again = await h.call("POST", "/auth/login", {
      body: { email, password: "correct-horse-battery" },
    });
    expect(again.statusCode).toBe(200);

    const audit = await h.db.auditEvent.findMany({
      // Staff actions only (sign-up also records the verification email, ADR-0035).
      where: { targetId: id, action: { startsWith: "customer." } },
      orderBy: { id: "asc" },
    });
    expect(audit.map((a) => a.action)).toEqual(["customer.disabled", "customer.enabled"]);
    expect(audit[0]!.metadata).toMatchObject({ reason: "Chargeback fraud report" });
  });

  it("signs a customer out of every device", async () => {
    const email = "lost-phone@example.com";
    const first = await h.register(email);
    const second = await h.call("POST", "/auth/login", {
      body: { email, password: "correct-horse-battery" },
    });
    expect(second.statusCode).toBe(200);
    const id = await customerId(email);

    const res = await h.call("POST", `/admin/customers/${id}/sign-out`, { session: owner });
    expect(res.statusCode).toBe(200);
    expect(res.json().sessionsEnded).toBe(2);
    expect((await h.call("GET", "/auth/session", { session: first })).statusCode).toBe(401);
  });

  it("is refused to staff who can only read customers", async () => {
    await h.register("someone@example.com");
    const id = await customerId("someone@example.com");
    const support = await h.staff("support");
    const read = await h.call("GET", `/admin/customers/${id}`, { session: support });
    expect(read.statusCode).toBe(200);
    const write = await h.call("PATCH", `/admin/customers/${id}`, {
      session: support,
      body: { status: "DISABLED", reason: "x" },
    });
    expect(write.statusCode).toBe(403);
  });

  // ── Site settings ──────────────────────────────────────────────────────────

  it("publishes contact details and the announcement to the website", async () => {
    const general = {
      supportPhone: "+8809612000000",
      supportEmail: "help@pegah.example",
      whatsapp: "",
      officeAddress: "Banani, Dhaka",
    };
    const g = await h.call("PUT", "/admin/settings/general", { session: owner, body: general });
    expect(g.statusCode).toBe(200);
    const halfDone = await h.call("PUT", "/admin/settings/announcement", {
      session: owner,
      body: {
        enabled: true,
        tone: "info",
        textEn: "Eid offers are live",
        textBn: "",
        linkHref: "",
      },
    });
    expect(halfDone.statusCode).toBe(400);
    await h.call("PUT", "/admin/settings/announcement", {
      session: owner,
      body: {
        enabled: true,
        tone: "info",
        textEn: "Eid offers are live",
        textBn: "ঈদের অফার চলছে",
        linkHref: "/pages/offers",
      },
    });
    const site = (await h.call("GET", "/site")).json();
    expect(site.general).toEqual(general);
    expect(site.announcement).toMatchObject({ textBn: "ঈদের অফার চলছে" });

    await h.call("PUT", "/admin/settings/announcement", {
      session: owner,
      body: { enabled: false, tone: "info", textEn: "", textBn: "", linkHref: "" },
    });
    expect((await h.call("GET", "/site")).json().announcement).toBeNull();
  });

  it("applies the hold length set in the console to new bookings", async () => {
    await h.call("PUT", "/admin/settings/booking", {
      session: owner,
      body: { holdMinutes: 25, paymentExtensionMinutes: 10 },
    });
    const booking = await hold(await h.register("hold-length@example.com"));
    const minutes = (new Date(booking.holdExpiresAt).getTime() - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(24);
    expect(minutes).toBeLessThanOrEqual(25);
  });

  it("stores payment credentials sealed, never returns them, and switches payments on and off", async () => {
    const password = "store-secret-123";
    const customer = await h.register("payer@example.com");
    const before = await hold(customer);
    expect(before.canPay).toBe(false);

    const saved = await h.call("PUT", "/admin/settings/payments", {
      session: owner,
      body: {
        provider: "sslcommerz",
        mode: "sandbox",
        liveApproved: false,
        storeId: "pegah01",
        storePassword: password,
      },
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.body).not.toContain(password);
    expect(saved.json().payments).toMatchObject({
      provider: "sslcommerz",
      storePasswordSet: true,
      source: "console",
    });
    const row = await h.db.secretSetting.findUniqueOrThrow({
      where: { key: "sslcommerz.storePassword" },
    });
    expect(row.ciphertext).not.toContain(password);
    const audit = await h.db.auditEvent.findFirstOrThrow({
      where: { action: "settings.payments_updated" },
    });
    expect(JSON.stringify(audit.metadata)).not.toContain(password);

    const after = await h.call("GET", `/me/bookings/${before.id}`, { session: customer });
    expect(after.json().canPay).toBe(true);

    // Saving without a password keeps the stored one.
    const kept = await h.call("PUT", "/admin/settings/payments", {
      session: owner,
      body: { provider: "sslcommerz", mode: "sandbox", liveApproved: false, storeId: "pegah02" },
    });
    expect(kept.json().payments).toMatchObject({ storeId: "pegah02", storePasswordSet: true });

    const live = await h.call("PUT", "/admin/settings/payments", {
      session: owner,
      body: { provider: "sslcommerz", mode: "live", liveApproved: false, storeId: "pegah02" },
    });
    expect(live.statusCode).toBe(400);

    await h.call("PUT", "/admin/settings/payments", {
      session: owner,
      body: { provider: "none", mode: "sandbox", liveApproved: false, storeId: "" },
    });
    const off = await h.call("GET", `/me/bookings/${before.id}`, { session: customer });
    expect(off.json().canPay).toBe(false);
  });

  it("lets only the owner change credentials, and admins the rest", async () => {
    const admin = await h.staff("admin");
    const payments = await h.call("PUT", "/admin/settings/payments", {
      session: admin,
      body: { provider: "none", mode: "sandbox", liveApproved: false, storeId: "" },
    });
    expect(payments.statusCode).toBe(403);
    const email = await h.call("PUT", "/admin/settings/email", { session: admin, body: NO_EMAIL });
    expect(email.statusCode).toBe(403);
    const booking = await h.call("PUT", "/admin/settings/booking", {
      session: admin,
      body: { holdMinutes: 15, paymentExtensionMinutes: 20 },
    });
    expect(booking.statusCode).toBe(200);
    const view = await h.call("GET", "/admin/settings/site", { session: admin });
    expect(view.json().encryptionReady).toBe(true);
  });

  it("saves SMTP settings with a sealed password and sends a test from the console", async () => {
    const saved = await h.call("PUT", "/admin/settings/email", {
      session: owner,
      body: {
        ...NO_EMAIL,
        transport: "smtp",
        smtpHost: "smtp.example.com",
        smtpUser: "mailer",
        smtpPassword: "smtp-secret-9",
      },
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.body).not.toContain("smtp-secret-9");
    expect(saved.json().email).toMatchObject({ transport: "smtp", smtpPasswordSet: true });

    await h.call("PUT", "/admin/settings/email", { session: owner, body: NO_EMAIL });
    const test = await h.call("POST", "/admin/settings/email/test", { session: owner });
    expect(test.json()).toMatchObject({ status: "SKIPPED" });
  });
});
