/* Payment flow against MySQL 8.4 with the simulator provider (ADR-0022).
 * Exercises the same callback → verification → state machine path that
 * SSLCOMMERZ will use. Skipped without PEGAH_IT_DATABASE_URL. */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HoldExpiryService } from "../booking/hold-expiry.service";
import { PAYMENT_PROVIDER } from "../payments/provider";
import type { SimulatorProvider } from "../payments/simulator.provider";
import { addDays, dhakaToday, formatCalendarDate } from "../common/time";
import { ADMIN_URL, createHarness, type Harness, type Session } from "./int-harness";

describe.skipIf(!ADMIN_URL)("payments against MySQL 8.4 (simulator provider)", () => {
  let h: Harness;
  let sim: SimulatorProvider;
  let alice: Session;
  const checkIn = formatCalendarDate(addDays(dhakaToday(), 10));
  const checkOut = formatCalendarDate(addDays(dhakaToday(), 12));

  async function holdRoom(session: Session): Promise<{ id: string; total: number }> {
    const quote = await h.call(
      "GET",
      `/quotes/hotel?roomId=${h.roomId}&checkIn=${checkIn}&checkOut=${checkOut}&adults=1&rooms=1`,
    );
    const total = quote.json().price.total;
    const res = await h.call("POST", "/bookings", {
      session,
      headers: { "idempotency-key": randomUUID() },
      body: {
        product: "HOTEL",
        roomId: h.roomId,
        checkIn,
        checkOut,
        rooms: 1,
        adults: 1,
        children: 0,
        contact: { name: "Alice Rahman", email: "alice@example.com", phone: "+8801711000000" },
        guests: [{ fullName: "Alice Rahman", ageGroup: "ADULT" }],
        expectedTotal: total,
      },
    });
    expect(res.statusCode).toBe(201);
    return { id: res.json().id, total: total.amountMinor };
  }

  async function startPayment(session: Session, bookingId: string) {
    const res = await h.call("POST", `/me/bookings/${bookingId}/payment-session`, {
      session,
      body: {},
    });
    expect(res.statusCode).toBe(201);
    return res.json() as { paymentId: string; redirectUrl: string; mode: string };
  }

  async function heldAndSold() {
    const rows = await h.db.roomInventory.findMany({
      where: {
        stayDate: { gte: new Date(`${checkIn}T00:00:00Z`), lt: new Date(`${checkOut}T00:00:00Z`) },
      },
    });
    return {
      held: rows.reduce((a, r) => a + r.held, 0),
      sold: rows.reduce((a, r) => a + r.sold, 0),
    };
  }

  beforeAll(async () => {
    h = await createHarness({
      PAYMENT_PROVIDER: "simulator",
      PUBLIC_BASE_URL: "http://localhost:3000",
      PAYMENT_HOLD_EXTENSION_MINUTES: "20",
    });
    sim = h.app.get<SimulatorProvider>(PAYMENT_PROVIDER);
    alice = await h.register("alice@example.com");
  }, 120_000);

  afterAll(async () => {
    await h?.close();
  });

  it("pays, verifies server-side and confirms, turning held rooms into sold", async () => {
    const { id } = await holdRoom(alice);
    const before = await h.call("GET", `/me/bookings/${id}`, { session: alice });
    expect(before.json()).toMatchObject({ canPay: true, payments: [] });

    const session = await startPayment(alice, id);
    expect(session.mode).toBe("simulator");
    expect(session.redirectUrl).toBe(
      `http://localhost:3000/api/v1/payments/simulator/${session.paymentId}`,
    );
    // The hold was extended once for the payment page.
    const extended = await h.db.booking.findFirstOrThrow({ where: { publicId: id } });
    expect(extended.holdExpiresAt!.getTime()).toBeGreaterThan(Date.now() + 19 * 60_000);

    const page = await h.call("GET", `/payments/simulator/${session.paymentId}`);
    expect(page.statusCode).toBe(200);
    expect(page.body).toContain("development only");

    const paid = await h.call("POST", `/payments/simulator/${session.paymentId}/success`);
    expect(paid.statusCode).toBe(303);
    expect(paid.headers.location).toBe(
      `http://localhost:3000/account/bookings/${id}?payment=success`,
    );

    const after = await h.call("GET", `/me/bookings/${id}`, { session: alice });
    expect(after.json()).toMatchObject({ status: "CONFIRMED", holdExpiresAt: null, canPay: false });
    expect(after.json().payments[0]).toMatchObject({ status: "SUCCEEDED", method: "SIMULATOR" });
    expect(after.json().history.map((x: { to: string }) => x.to)).toEqual([
      "PENDING_AVAILABILITY",
      "PENDING_PAYMENT",
      "PAYMENT_PROCESSING",
      "CONFIRMED",
    ]);
    expect(await heldAndSold()).toEqual({ held: 0, sold: 2 });
    const holds = await h.db.inventoryHold.findMany({ where: { booking: { publicId: id } } });
    expect(holds.every((x) => x.status === "CONVERTED")).toBe(true);
    expect(await h.db.outboxEvent.count({ where: { eventType: "booking.confirmed" } })).toBe(1);

    // A duplicate delivery of the same callback changes nothing.
    await h.call("POST", `/payments/simulator/${session.paymentId}/success`);
    expect(await heldAndSold()).toEqual({ held: 0, sold: 2 });
    expect(await h.db.outboxEvent.count({ where: { eventType: "booking.confirmed" } })).toBe(1);
  });

  it("keeps the booking payable when the payment fails or is cancelled", async () => {
    const { id } = await holdRoom(alice);
    const first = await startPayment(alice, id);
    const failed = await h.call("POST", `/payments/simulator/${first.paymentId}/fail`);
    expect(failed.headers.location).toContain("payment=failed");
    const second = await startPayment(alice, id);
    await h.call("POST", `/payments/simulator/${second.paymentId}/cancel`);
    const b = await h.call("GET", `/me/bookings/${id}`, { session: alice });
    expect(b.json()).toMatchObject({ status: "PENDING_PAYMENT", canPay: true });
    expect(b.json().payments.map((p: { status: string }) => p.status)).toEqual([
      "CANCELLED",
      "FAILED",
    ]);
  });

  it("sends an amount mismatch to manual review and flags the payment for refund", async () => {
    const { id, total } = await holdRoom(alice);
    const s = await startPayment(alice, id);
    sim.complete(s.paymentId, "success", { amountMinor: BigInt(total - 100) });
    await h.call("POST", "/payments/sslcommerz/ipn", { form: { tran_id: s.paymentId } }); // wrong provider: 404, ignored
    const res = await h.call("POST", `/payments/simulator/${s.paymentId}/success`);
    expect(res.headers.location).toContain("payment=review");
    // complete() above already set the tampered amount; the route call re-completes
    // with the stored (tampered) amount, so verification sees the mismatch.
    const b = await h.call("GET", `/me/bookings/${id}`, { session: alice });
    expect(b.json().status).toBe("MANUAL_REVIEW");
    expect(b.json().payments[0].status).toBe("REFUND_REQUIRED");
  });

  it("never confirms a booking whose hold already expired; the payment is flagged for refund", async () => {
    const { id } = await holdRoom(alice);
    const s = await startPayment(alice, id);
    // The hold runs out before the customer finishes, and the sweeper finds
    // no completed payment at the provider.
    const expiry = h.app.get(HoldExpiryService);
    await expiry.sweep(new Date(Date.now() + 60 * 60_000));
    expect((await h.db.booking.findFirstOrThrow({ where: { publicId: id } })).status).toBe(
      "EXPIRED",
    );

    const late = await h.call("POST", `/payments/simulator/${s.paymentId}/success`);
    expect(late.headers.location).toContain("payment=review");
    const b = await h.call("GET", `/me/bookings/${id}`, { session: alice });
    expect(b.json().status).toBe("EXPIRED");
    expect(b.json().payments[0]).toMatchObject({ status: "REFUND_REQUIRED" });
    expect(await h.db.outboxEvent.count({ where: { eventType: "payment.refund_required" } })).toBe(
      2,
    );
  });

  it("confirms instead of expiring when the provider has the payment but the callback was lost", async () => {
    const { id } = await holdRoom(alice);
    const s = await startPayment(alice, id);
    sim.complete(s.paymentId, "success"); // paid at the provider; no callback reaches us
    await h.app.get(HoldExpiryService).sweep(new Date(Date.now() + 60 * 60_000));
    const b = await h.call("GET", `/me/bookings/${id}`, { session: alice });
    expect(b.json().status).toBe("CONFIRMED");
  });

  it("rejects payment of someone else's booking and of bookings that are not payable", async () => {
    const bob = await h.register("bob@example.com");
    const { id } = await holdRoom(alice);
    const other = await h.call("POST", `/me/bookings/${id}/payment-session`, {
      session: bob,
      body: {},
    });
    expect(other.statusCode).toBe(404);
    await h.call("POST", `/me/bookings/${id}/cancel`, { session: alice, body: {} });
    const cancelled = await h.call("POST", `/me/bookings/${id}/payment-session`, {
      session: alice,
      body: {},
    });
    expect(cancelled.statusCode).toBe(409);
    expect(cancelled.json().type).toBe("/problems/booking-not-payable");
  });

  it("ignores callbacks for unknown transactions and lists payments for finance staff only", async () => {
    const unknown = await h.call("POST", "/payments/simulator/01JC0000000000000000000XXX/success");
    expect(unknown.statusCode).toBe(404);
    const admin = await h.call("GET", "/admin/payments", { session: alice });
    expect(admin.statusCode).toBe(401); // a customer session is not a staff session
  });
});
