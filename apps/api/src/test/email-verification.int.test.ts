/* Email verification for customer accounts against MySQL 8.4 (ADR-0035). */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EmailService, type OutgoingEmail } from "../email/email.service";
import { IntegrationSettings } from "../settings/integration-settings.service";
import { addDays, dhakaToday, formatCalendarDate } from "../common/time";
import { ADMIN_URL, createHarness, type Harness, type Session } from "./int-harness";

describe.skipIf(!ADMIN_URL)("email verification against MySQL 8.4", () => {
  let h: Harness;
  let owner: Session;
  const sent: OutgoingEmail[] = [];

  const linkFor = (to: string) => {
    const mail = [...sent]
      .reverse()
      .find((m) => m.to === to && m.template === "email-verification");
    const token = mail?.text.match(/verify-email\?token=([\w-]+)/)?.[1];
    if (!token) throw new Error(`no verification email for ${to}`);
    return token;
  };

  beforeAll(async () => {
    // SMTP settings are present but nothing is ever sent: send() is captured below.
    h = await createHarness({
      PUBLIC_BASE_URL: "http://localhost:3000",
      EMAIL_TRANSPORT: "smtp",
      SMTP_HOST: "smtp.invalid",
      SMTP_USER: "test",
      SMTP_PASSWORD: "test-only",
    });
    const email = h.app.get(EmailService);
    email.send = async (msg) => {
      sent.push(msg);
      return "SENT" as const;
    };
    owner = await h.staff("owner");
  }, 120_000);
  afterAll(() => h?.close());

  it("emails a link at sign-up and verifies the account with it once", async () => {
    const alice = await h.register("verify-alice@example.com");
    expect((await h.call("GET", "/me/profile", { session: alice })).json().emailVerified).toBe(
      false,
    );
    const token = linkFor("verify-alice@example.com");
    // Only the hash is stored.
    const rows = await h.db.emailVerificationToken.findMany();
    expect(rows.every((r) => r.tokenHash !== token && r.tokenHash.length === 64)).toBe(true);

    expect((await h.call("POST", "/auth/verify-email", { body: { token } })).statusCode).toBe(204);
    expect((await h.call("GET", "/me/profile", { session: alice })).json().emailVerified).toBe(
      true,
    );
    // Single use.
    const again = await h.call("POST", "/auth/verify-email", { body: { token } });
    expect(again.statusCode).toBe(400);
    expect(again.json().code ?? again.json().type).toBeDefined();

    // Staff see it in the customer list.
    const list = (
      await h.call("GET", "/admin/customers?q=verify-alice", { session: owner })
    ).json();
    expect(list.items[0].emailVerified).toBe(true);
  });

  it("replaces older links when a new one is requested, and refuses expired links", async () => {
    const bob = await h.register("verify-bob@example.com");
    const first = linkFor("verify-bob@example.com");
    expect((await h.call("POST", "/me/email-verification", { session: bob })).statusCode).toBe(202);
    const second = linkFor("verify-bob@example.com");
    expect(second).not.toBe(first);
    expect(
      (await h.call("POST", "/auth/verify-email", { body: { token: first } })).statusCode,
    ).toBe(400);

    await h.db.emailVerificationToken.updateMany({
      where: { user: { email: "verify-bob@example.com" }, usedAt: null },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(
      (await h.call("POST", "/auth/verify-email", { body: { token: second } })).statusCode,
    ).toBe(400);
  });

  it("blocks holds and orders for unverified customers only when the console requires it", async () => {
    const carol = await h.register("verify-carol@example.com");
    const checkIn = formatCalendarDate(addDays(dhakaToday(), 6));
    const checkOut = formatCalendarDate(addDays(dhakaToday(), 7));
    const hold = async () => {
      const quote = await h.call(
        "GET",
        `/quotes/hotel?roomId=${h.roomId}&checkIn=${checkIn}&checkOut=${checkOut}&adults=1&rooms=1`,
      );
      return h.call("POST", "/bookings", {
        session: carol,
        headers: { "idempotency-key": randomUUID() },
        body: {
          product: "HOTEL",
          roomId: h.roomId,
          checkIn,
          checkOut,
          rooms: 1,
          adults: 1,
          children: 0,
          contact: {
            name: "Carol Das",
            email: "verify-carol@example.com",
            phone: "+8801711000000",
          },
          guests: [{ fullName: "Carol Das", ageGroup: "ADULT" }],
          expectedTotal: quote.json().price.total,
        },
      });
    };

    // Off by default.
    const free = await hold();
    expect(free.statusCode).toBe(201);
    await h.call("POST", `/me/bookings/${free.json().id}/cancel`, { session: carol, body: {} });

    const saved = await h.call("PUT", "/admin/settings/booking", {
      session: owner,
      body: { holdMinutes: 15, paymentExtensionMinutes: 10, requireVerifiedEmail: true },
    });
    expect(saved.statusCode).toBe(200);
    await h.app.get(IntegrationSettings).reload();
    expect(h.app.get(IntegrationSettings).requireVerifiedEmail()).toBe(true);

    const blocked = await hold();
    expect(blocked.statusCode).toBe(403);
    expect(JSON.stringify(blocked.json())).toContain("email-not-verified");

    await h.call("POST", "/auth/verify-email", {
      body: { token: linkFor("verify-carol@example.com") },
    });
    expect((await hold()).statusCode).toBe(201);
  });
});
