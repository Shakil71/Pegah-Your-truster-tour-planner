/* Staff password reset by email, against MySQL 8.4. Its own harness: staff
 * sign-in is limited to 5 a minute, which other suites already use up. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EmailService, type OutgoingEmail } from "../email/email.service";
import { ADMIN_URL, createHarness, type Harness } from "./int-harness";

describe.skipIf(!ADMIN_URL)("staff password reset against MySQL 8.4", () => {
  let h: Harness;
  const sent: OutgoingEmail[] = [];

  beforeAll(async () => {
    h = await createHarness({
      PUBLIC_BASE_URL: "http://localhost:3000",
      EMAIL_TRANSPORT: "none",
    });
    const email = h.app.get(EmailService);
    const original = email.send.bind(email);
    email.send = async (msg) => {
      sent.push(msg);
      return original(msg);
    };
  }, 120_000);
  afterAll(() => h?.close());

  it("lets staff reset a forgotten password from the console, and signs them out", async () => {
    const before = await h.db.user.findMany({ where: { kind: "STAFF" }, select: { id: true } });
    const session = await h.staff("support");
    const me = await h.db.user.findFirstOrThrow({
      where: { kind: "STAFF", id: { notIn: before.map((u) => u.id) } },
    });
    sent.length = 0;
    const res = await h.call("POST", "/auth/password-reset/request", { body: { email: me.email } });
    expect(res.statusCode).toBe(202);
    await new Promise((r) => setTimeout(r, 50)); // the email goes out in the background
    const text = sent.find((m) => m.template === "password-reset" && m.to === me.email)!.text;
    // The link opens the console, not the shop.
    const token = text.match(/\/admin\/reset-password\?token=([A-Za-z0-9_-]+)/)![1]!;

    const ok = await h.call("POST", "/auth/password-reset/confirm", {
      body: { token, newPassword: "staff-reset-passphrase-1" },
    });
    expect(ok.statusCode).toBe(204);
    // The old session is gone; the new password works on the staff login.
    expect((await h.call("GET", "/staff/auth/session", { session })).statusCode).toBe(401);
    const login = await h.call("POST", "/staff/auth/login", {
      body: { email: me.email, password: "staff-reset-passphrase-1" },
    });
    expect(login.statusCode).toBe(200);
    const audit = await h.db.auditEvent.findFirstOrThrow({
      where: { action: "account.password_reset", actorUserId: me.id },
    });
    expect(audit.actorType).toBe("STAFF");

    // A disabled staff account gets nothing.
    await h.db.user.update({ where: { id: me.id }, data: { status: "DISABLED" } });
    sent.length = 0;
    await h.call("POST", "/auth/password-reset/request", { body: { email: me.email } });
    await new Promise((r) => setTimeout(r, 50));
    expect(sent).toHaveLength(0);
  });
});
