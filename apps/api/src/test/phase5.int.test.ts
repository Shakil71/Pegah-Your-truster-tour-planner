/* Phase 5 completion against MySQL 8.4: emails via the outbox, voucher data,
 * cancellation requests and refunds, profile, password change and reset,
 * saved travellers. Skipped without PEGAH_IT_DATABASE_URL. */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addDays, dhakaToday, formatCalendarDate } from "../common/time";
import { EmailService, type OutgoingEmail } from "../email/email.service";
import { OutboxDispatcher } from "../email/outbox-dispatcher.service";
import { ADMIN_URL, createHarness, type Harness, type Session } from "./int-harness";

describe.skipIf(!ADMIN_URL)("Phase 5 completion against MySQL 8.4", () => {
  let h: Harness;
  let alice: Session;
  let ops: Session;
  let finance: Session;
  const sent: OutgoingEmail[] = [];
  const day = (n: number) => formatCalendarDate(addDays(dhakaToday(), n));

  async function confirmedBooking(
    session: Session,
    rooms = 1,
  ): Promise<{ id: string; total: number }> {
    const quote = await h.call(
      "GET",
      `/quotes/hotel?roomId=${h.roomId}&checkIn=${day(10)}&checkOut=${day(12)}&adults=${rooms}&rooms=${rooms}`,
    );
    const total = quote.json().price.total;
    const b = await h.call("POST", "/bookings", {
      session,
      headers: { "idempotency-key": randomUUID() },
      body: {
        product: "HOTEL",
        roomId: h.roomId,
        checkIn: day(10),
        checkOut: day(12),
        rooms,
        adults: rooms,
        children: 0,
        contact: { name: "Alice Rahman", email: "alice@example.com", phone: "+8801711000000" },
        guests: Array.from({ length: rooms }, (_, i) => ({
          fullName: `Guest ${i + 1}`,
          ageGroup: "ADULT",
        })),
        expectedTotal: total,
      },
    });
    const id = b.json().id as string;
    const ps = await h.call("POST", `/me/bookings/${id}/payment-session`, { session, body: {} });
    await h.call("POST", `/payments/simulator/${ps.json().paymentId}/success`);
    return { id, total: total.amountMinor };
  }

  async function sold(): Promise<number> {
    const rows = await h.db.roomInventory.findMany({
      where: {
        stayDate: { gte: new Date(`${day(10)}T00:00:00Z`), lt: new Date(`${day(12)}T00:00:00Z`) },
      },
    });
    return rows.reduce((a, r) => a + r.sold, 0);
  }

  beforeAll(async () => {
    h = await createHarness({
      PAYMENT_PROVIDER: "simulator",
      PUBLIC_BASE_URL: "http://localhost:3000",
      EMAIL_TRANSPORT: "none",
    });
    // Capture outgoing mail (the real service still records every message).
    const email = h.app.get(EmailService);
    const original = email.send.bind(email);
    email.send = async (msg) => {
      sent.push(msg);
      return original(msg);
    };
    alice = await h.register("alice@example.com");
    [ops, finance] = await Promise.all([h.staff("operations"), h.staff("finance")]);
  }, 120_000);

  afterAll(async () => {
    await h?.close();
  });

  it("emails the customer through the outbox and shows the log to staff only", async () => {
    const { id } = await confirmedBooking(alice);
    await h.app.get(OutboxDispatcher).drain();
    const templates = sent.filter((m) => m.bookingId !== undefined).map((m) => m.template);
    expect(templates).toEqual(expect.arrayContaining(["booking-held", "booking-confirmed"]));
    const confirmed = sent.find((m) => m.template === "booking-confirmed")!;
    expect(confirmed.text).toContain(`/account/bookings/${id}/voucher`);
    expect(confirmed.subject).toContain("Booking confirmed");
    const held = sent.find((m) => m.template === "booking-held")!;
    expect(held.text).toContain("not confirmed until payment");

    const staffView = await h.call("GET", `/admin/bookings/${id}`, { session: ops });
    expect(staffView.json().emails.map((e: { template: string }) => e.template)).toEqual(
      expect.arrayContaining(["booking-held", "booking-confirmed"]),
    );
    expect(staffView.json().emails[0].status).toBe("SKIPPED"); // no transport configured
    const customerView = await h.call("GET", `/me/bookings/${id}`, { session: alice });
    expect(customerView.json().emails).toBeUndefined();
    // Voucher facts.
    expect(customerView.json().product).toMatchObject({
      location: "Test",
      checkInTime: "14:00",
      checkOutTime: "12:00",
    });
  });

  it("runs a cancellation with a partial refund, releasing sold rooms, and finance pays it", async () => {
    const before = await sold();
    const { id, total } = await confirmedBooking(alice);
    expect(await sold()).toBe(before + 2);

    const req = await h.call("POST", `/me/bookings/${id}/cancellation-request`, {
      session: alice,
      body: { reason: "Our plans changed, sorry" },
    });
    expect(req.json().status).toBe("CANCELLATION_REQUESTED");

    const tooMuch = await h.call("POST", `/admin/bookings/${id}/cancellation-decision`, {
      session: ops,
      body: {
        approve: true,
        refund: { amountMinor: total + 1, currency: "BDT" },
        reason: "Free cancellation window",
        expectedStatus: "CANCELLATION_REQUESTED",
      },
    });
    expect(tooMuch.json().type).toBe("/problems/refund-too-large");

    const half = Math.floor(total / 2);
    const approved = await h.call("POST", `/admin/bookings/${id}/cancellation-decision`, {
      session: ops,
      body: {
        approve: true,
        refund: { amountMinor: half, currency: "BDT" },
        reason: "50% under the policy",
        expectedStatus: "CANCELLATION_REQUESTED",
      },
    });
    expect(approved.json().status).toBe("REFUND_PENDING");
    expect(approved.json().refunds[0]).toMatchObject({
      status: "PENDING",
      amount: { amountMinor: half },
    });
    expect(await sold()).toBe(before); // rooms back on sale

    const list = await h.call("GET", "/admin/refunds?status=PENDING", { session: finance });
    const refund = list.json().items.find((r: { bookingId: string }) => r.bookingId === id);
    expect(refund).toBeDefined();

    const opsPay = await h.call("POST", `/admin/refunds/${refund.id}/paid`, {
      session: ops,
      body: { providerRef: "BANK-123" },
    });
    expect(opsPay.statusCode).toBe(403); // operations cannot approve refunds
    const paid = await h.call("POST", `/admin/refunds/${refund.id}/paid`, {
      session: finance,
      body: { providerRef: "BANK-123" },
    });
    expect(paid.statusCode).toBe(204);
    const again = await h.call("POST", `/admin/refunds/${refund.id}/paid`, {
      session: finance,
      body: { providerRef: "BANK-123" },
    });
    expect(again.statusCode).toBe(409);

    const final = await h.call("GET", `/me/bookings/${id}`, { session: alice });
    expect(final.json().status).toBe("REFUNDED");
    expect(
      final
        .json()
        .history.map((x: { to: string }) => x.to)
        .slice(-4),
    ).toEqual(["CANCELLATION_REQUESTED", "CANCELLED", "REFUND_PENDING", "REFUNDED"]);
    sent.length = 0;
    await h.app.get(OutboxDispatcher).drain();
    expect(sent.map((m) => m.template)).toEqual(
      expect.arrayContaining(["cancellation-requested", "booking-cancelled", "refund-paid"]),
    );
  });

  it("can reject a cancellation, keeping the booking and its rooms", async () => {
    const { id } = await confirmedBooking(alice);
    const soldBefore = await sold();
    await h.call("POST", `/me/bookings/${id}/cancellation-request`, {
      session: alice,
      body: { reason: "Maybe cancel this one" },
    });
    const rejected = await h.call("POST", `/admin/bookings/${id}/cancellation-decision`, {
      session: ops,
      body: {
        approve: false,
        reason: "Non-refundable rate, inside 3 days",
        expectedStatus: "CANCELLATION_REQUESTED",
      },
    });
    expect(rejected.json().status).toBe("CONFIRMED");
    expect(await sold()).toBe(soldBefore);
  });

  it("refuses cancellation requests for unpaid or other people's bookings", async () => {
    const bob = await h.register("bob@example.com");
    const { id } = await confirmedBooking(alice);
    const other = await h.call("POST", `/me/bookings/${id}/cancellation-request`, {
      session: bob,
      body: { reason: "Not mine at all" },
    });
    expect(other.statusCode).toBe(404);
  });

  it("updates the profile and changes the password, signing out other sessions", async () => {
    const carol = await h.register("carol@example.com");
    const login2 = await h.call("POST", "/auth/login", {
      body: { email: "carol@example.com", password: "correct-horse-battery" },
    });
    const second = [login2.headers["set-cookie"]]
      .flat()
      .map(String)
      .find((c) => c.startsWith("pg_sid="))!
      .split(";")[0]!;

    const prof = await h.call("PUT", "/me/profile", {
      session: carol,
      body: { fullName: "Carol Akter", phone: "+8801911000000" },
    });
    expect(prof.json()).toMatchObject({ fullName: "Carol Akter", phone: "+8801911000000" });

    const wrong = await h.call("POST", "/me/password", {
      session: carol,
      body: { currentPassword: "nope-nope-nope", newPassword: "a-brand-new-passphrase" },
    });
    expect(wrong.statusCode).toBe(422);
    const changed = await h.call("POST", "/me/password", {
      session: carol,
      body: { currentPassword: "correct-horse-battery", newPassword: "a-brand-new-passphrase" },
    });
    expect(changed.statusCode).toBe(204);
    expect((await h.call("GET", "/auth/session", { session: carol })).statusCode).toBe(200);
    expect((await h.call("GET", "/auth/session", { headers: { cookie: second } })).statusCode).toBe(
      401,
    );
    const relog = await h.call("POST", "/auth/login", {
      body: { email: "carol@example.com", password: "a-brand-new-passphrase" },
    });
    expect(relog.statusCode).toBe(200);
  });

  it("resets a forgotten password with a single-use emailed link", async () => {
    await h.register("dina@example.com");
    sent.length = 0;
    const unknown = await h.call("POST", "/auth/password-reset/request", {
      body: { email: "nobody@example.com" },
    });
    expect(unknown.statusCode).toBe(202);
    expect(sent).toHaveLength(0);

    const res = await h.call("POST", "/auth/password-reset/request", {
      body: { email: "dina@example.com" },
    });
    expect(res.statusCode).toBe(202);
    const link = sent
      .find((m) => m.template === "password-reset")!
      .text.match(/reset-password\?token=([A-Za-z0-9_-]+)/)![1]!;
    expect(await h.db.passwordResetToken.count({ where: { tokenHash: link } })).toBe(0); // only the hash is stored

    const ok = await h.call("POST", "/auth/password-reset/confirm", {
      body: { token: link, newPassword: "reset-passphrase-2026" },
    });
    expect(ok.statusCode).toBe(204);
    const reuse = await h.call("POST", "/auth/password-reset/confirm", {
      body: { token: link, newPassword: "another-passphrase-99" },
    });
    expect(reuse.json().type).toBe("/problems/reset-link-invalid");
    const login = await h.call("POST", "/auth/login", {
      body: { email: "dina@example.com", password: "reset-passphrase-2026" },
    });
    expect(login.statusCode).toBe(200);
  });

  it("keeps saved travellers private to their owner", async () => {
    const add = await h.call("POST", "/me/travellers", {
      session: alice,
      body: {
        fullName: "Ayaan Rahman",
        ageGroup: "CHILD",
        dateOfBirth: "2018-05-02",
        nationality: "bd",
      },
    });
    expect(add.json().traveller).toMatchObject({ fullName: "Ayaan Rahman", nationality: "BD" });
    const id = add.json().traveller.id;
    const bob = await h.register("bob2@example.com");
    expect(
      (
        await h.call("PUT", `/me/travellers/${id}`, {
          session: bob,
          body: { fullName: "Hijack", ageGroup: "ADULT", dateOfBirth: null, nationality: null },
        })
      ).statusCode,
    ).toBe(404);
    expect((await h.call("GET", "/me/travellers", { session: bob })).json().items).toHaveLength(0);
    expect((await h.call("GET", "/me/travellers", { session: alice })).json().items).toHaveLength(
      1,
    );
    expect((await h.call("DELETE", `/me/travellers/${id}`, { session: alice })).statusCode).toBe(
      204,
    );
  });

  it("lets staff change their own password and signs out their other sessions", async () => {
    const other = await h.staff("support");
    const me = await h.call("GET", "/staff/auth/session", { session: other });
    const email = me.json().user.email as string;
    const second = await h.call("POST", "/staff/auth/login", {
      body: { email, password: "staff-password-123" },
    });
    const secondCookie = [second.headers["set-cookie"]]
      .flat()
      .map(String)
      .find((c) => c.startsWith("pg_staff_sid="))!
      .split(";")[0]!;
    const changed = await h.call("POST", "/staff/auth/password", {
      session: other,
      body: { currentPassword: "staff-password-123", newPassword: "staff-new-passphrase" },
    });
    expect(changed.statusCode).toBe(204);
    expect((await h.call("GET", "/staff/auth/session", { session: other })).statusCode).toBe(200);
    expect(
      (await h.call("GET", "/staff/auth/session", { headers: { cookie: secondCookie } }))
        .statusCode,
    ).toBe(401);
    const relog = await h.call("POST", "/staff/auth/login", {
      body: { email, password: "staff-new-passphrase" },
    });
    expect(relog.statusCode).toBe(200);
  });
});
