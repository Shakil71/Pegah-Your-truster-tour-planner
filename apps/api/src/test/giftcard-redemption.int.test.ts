/* Paying for bookings with gift cards against MySQL 8.4 (ADR-0034). */
import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HoldExpiryService } from "../booking/hold-expiry.service";
import { GiftCardService } from "../commerce/gift-card.service";
import { addDays, dhakaToday, formatCalendarDate } from "../common/time";
import { ADMIN_URL, createHarness, type Harness, type Session } from "./int-harness";

describe.skipIf(!ADMIN_URL)("gift card redemption against MySQL 8.4", () => {
  let h: Harness;
  let alice: Session;
  let bob: Session;
  let offset = 1;

  /** A fresh stay each time so tests do not share inventory. */
  async function holdRoom(session: Session) {
    offset += 2;
    const checkIn = formatCalendarDate(addDays(dhakaToday(), offset));
    const checkOut = formatCalendarDate(addDays(dhakaToday(), offset + 1));
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
    return { id: res.json().id as string, total: BigInt(total.amountMinor) };
  }

  async function card(amountMinor: bigint) {
    const svc = h.app.get(GiftCardService);
    return h.db.$transaction((tx) =>
      svc.issueInTx(tx, {
        amountMinor,
        currency: "BDT",
        recipientName: "Alice Rahman",
        recipientEmail: "alice@example.com",
        note: "test",
      }),
    );
  }

  const balance = async (id: bigint) =>
    (await h.db.giftCard.findUniqueOrThrow({ where: { id } })).balanceMinor;

  // Each call from its own address unless given one: only the rate-limit test shares a budget.
  let client = 0;
  const apply = (session: Session, bookingId: string, code: string, remoteAddress?: string) =>
    h.call("POST", `/me/bookings/${bookingId}/gift-card`, {
      session,
      body: { code },
      remoteAddress: remoteAddress ?? `10.20.0.${++client}`,
    });

  beforeAll(async () => {
    h = await createHarness({
      PAYMENT_PROVIDER: "simulator",
      PUBLIC_BASE_URL: "http://localhost:3000",
      SETTINGS_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
    });
    alice = await h.register("alice-gc@example.com");
    bob = await h.register("bob-gc@example.com");
  }, 120_000);
  afterAll(() => h?.close());

  it("covers part of a booking, then asks online payment only for the rest", async () => {
    const { id, total } = await holdRoom(alice);
    const part = total / 4n;
    const c = await card(part);

    // Code entry is forgiving about case, spaces and dashes.
    const formatted = c.code.toLowerCase().match(/.{4}/g)!.join(" - ");
    const res = await apply(alice, id, formatted);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      applied: { amountMinor: Number(part) },
      amountDue: { amountMinor: Number(total - part) },
      cardBalance: { amountMinor: 0 },
      bookingStatus: "PENDING_PAYMENT",
    });
    const detail = (await h.call("GET", `/me/bookings/${id}`, { session: alice })).json();
    expect(detail.amountDue.amountMinor).toBe(Number(total - part));
    expect(detail.payments[0]).toMatchObject({ provider: "GIFT_CARD", status: "SUCCEEDED" });
    expect(detail.payments[0].method).toBe(`Gift card ••${c.code.slice(-4)}`);

    // An empty card cannot be applied again.
    expect((await apply(alice, id, c.code)).statusCode).toBe(409);

    const session = await h.call("POST", `/me/bookings/${id}/payment-session`, {
      session: alice,
      body: {},
    });
    expect(session.statusCode).toBe(201);
    const online = await h.db.payment.findFirstOrThrow({
      where: { publicId: session.json().paymentId },
    });
    expect(online.amountMinor).toBe(total - part);

    await h.call("POST", `/payments/simulator/${online.publicId}/success`);
    const after = (await h.call("GET", `/me/bookings/${id}`, { session: alice })).json();
    expect(after.status).toBe("CONFIRMED");
    const txns = await h.db.giftCardTxn.findMany({
      where: { giftCardId: c.id },
      orderBy: { id: "asc" },
    });
    expect(txns.map((t) => t.kind)).toEqual(["ISSUE", "REDEEM"]);
  });

  it("confirms the booking when gift cards cover the whole total, keeping the rest on the card", async () => {
    const { id, total } = await holdRoom(alice);
    const c = await card(total + 50_000n);
    const res = await apply(alice, id, c.code);
    expect(res.json()).toMatchObject({
      applied: { amountMinor: Number(total) },
      amountDue: { amountMinor: 0 },
      cardBalance: { amountMinor: 50_000 },
      bookingStatus: "CONFIRMED",
    });
    const b = await h.db.booking.findFirstOrThrow({
      where: { publicId: id },
      include: { history: { orderBy: { id: "asc" } } },
    });
    expect(b.status).toBe("CONFIRMED");
    expect(b.history.at(-1)).toMatchObject({
      toStatus: "CONFIRMED",
      actorType: "PAYMENT_PROVIDER",
    });
    const holds = await h.db.inventoryHold.findMany({ where: { bookingId: b.id } });
    expect(holds.every((x) => x.status === "CONVERTED")).toBe(true);
    expect(
      await h.db.outboxEvent.count({ where: { eventType: "booking.confirmed", aggregateId: id } }),
    ).toBe(1);
    expect(await balance(c.id)).toBe(50_000n);
  });

  it("returns the money to the card when the hold expires unpaid", async () => {
    const { id, total } = await holdRoom(alice);
    const c = await card(total / 2n);
    await apply(alice, id, c.code);
    expect(await balance(c.id)).toBe(0n);

    await h.app.get(HoldExpiryService).sweep(new Date(Date.now() + 2 * 60 * 60_000));
    const b = await h.db.booking.findFirstOrThrow({ where: { publicId: id } });
    expect(b.status).toBe("EXPIRED");
    expect(await balance(c.id)).toBe(total / 2n);
    const pay = await h.db.payment.findFirstOrThrow({
      where: { bookingId: b.id, provider: "GIFT_CARD" },
    });
    expect(pay.status).toBe("CANCELLED");
    const kinds = (
      await h.db.giftCardTxn.findMany({ where: { giftCardId: c.id }, orderBy: { id: "asc" } })
    ).map((t) => t.kind);
    expect(kinds).toEqual(["ISSUE", "REDEEM", "RELEASE"]);
  });

  it("lets the customer remove a card before paying, and the open payment page stops counting", async () => {
    const { id, total } = await holdRoom(alice);
    const c = await card(total / 2n);
    const open = await h.call("POST", `/me/bookings/${id}/payment-session`, {
      session: alice,
      body: {},
    });
    await apply(alice, id, c.code);
    // The page opened for the full amount can no longer confirm the booking.
    const stale = await h.db.payment.findFirstOrThrow({
      where: { publicId: open.json().paymentId },
    });
    expect(stale.status).toBe("CANCELLED");

    const gc = await h.db.payment.findFirstOrThrow({
      where: { booking: { publicId: id }, provider: "GIFT_CARD" },
    });
    expect(
      (await h.call("DELETE", `/me/bookings/${id}/gift-card/${gc.publicId}`, { session: bob }))
        .statusCode,
    ).toBe(404);
    const removed = await h.call("DELETE", `/me/bookings/${id}/gift-card/${gc.publicId}`, {
      session: alice,
    });
    expect(removed.statusCode).toBe(204);
    expect(await balance(c.id)).toBe(total / 2n);
    const detail = (await h.call("GET", `/me/bookings/${id}`, { session: alice })).json();
    expect(detail.amountDue.amountMinor).toBe(Number(total));

    // Paying the old full-amount page now matches what is due again, so it confirms normally.
    await h.call("POST", `/payments/simulator/${open.json().paymentId}/success`);
    expect((await h.db.booking.findFirstOrThrow({ where: { publicId: id } })).status).toBe(
      "CONFIRMED",
    );
  });

  it("refuses other people's bookings, unknown and void cards, and is rate limited", async () => {
    const { id, total } = await holdRoom(alice);
    const c = await card(total);
    expect((await apply(bob, id, c.code)).statusCode).toBe(404);
    expect((await apply(alice, id, "ABCDEFGHJKLMNPQR")).statusCode).toBe(404);
    await h.db.giftCard.update({ where: { id: c.id }, data: { status: "VOID", balanceMinor: 0n } });
    const v = await apply(alice, id, c.code);
    expect(v.statusCode).toBe(404);
    expect(v.json().code ?? v.json().type).toBeDefined();
    let limited = false;
    for (let i = 0; i < 6 && !limited; i++) {
      limited = (await apply(alice, id, "ABCDEFGHJKLMNPQR", "10.30.0.1")).statusCode === 429;
    }
    expect(limited).toBe(true);
  });

  it("enforces the gift card link on payment rows at the database level", async () => {
    const b = await h.db.booking.findFirstOrThrow();
    await expect(
      h.db.payment.create({
        data: {
          publicId: "01JABCDEFGHJKMNPQRSTVWXYZ0",
          bookingId: b.id,
          provider: "GIFT_CARD",
          providerTxnId: "x",
          amountMinor: 100n,
        },
      }),
    ).rejects.toThrow();
  });
});
