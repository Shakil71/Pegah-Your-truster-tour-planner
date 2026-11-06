/* Refunds of gift-card-paid bookings go back to the card, against MySQL 8.4 (ADR-0037). */
import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GiftCardService } from "../commerce/gift-card.service";
import { addDays, dhakaToday, formatCalendarDate } from "../common/time";
import { ADMIN_URL, createHarness, type Harness, type Session } from "./int-harness";

describe.skipIf(!ADMIN_URL)("gift card refunds against MySQL 8.4", () => {
  let h: Harness;
  let alice: Session;
  let owner: Session;
  let offset = 2;
  let client = 0;

  async function holdRoom() {
    offset += 2;
    const checkIn = formatCalendarDate(addDays(dhakaToday(), offset));
    const checkOut = formatCalendarDate(addDays(dhakaToday(), offset + 1));
    const quote = await h.call(
      "GET",
      `/quotes/hotel?roomId=${h.roomId}&checkIn=${checkIn}&checkOut=${checkOut}&adults=1&rooms=1`,
    );
    const total = quote.json().price.total;
    const res = await h.call("POST", "/bookings", {
      session: alice,
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

  const apply = (bookingId: string, code: string) =>
    h.call("POST", `/me/bookings/${bookingId}/gift-card`, {
      session: alice,
      body: { code },
      remoteAddress: `10.30.0.${++client}`,
    });

  /** Pays the rest online (simulator) so the booking is CONFIRMED. */
  async function payRest(bookingId: string) {
    const s = await h.call("POST", `/me/bookings/${bookingId}/payment-session`, {
      session: alice,
      body: {},
    });
    expect(s.statusCode).toBe(201);
    await h.call("POST", `/payments/simulator/${s.json().paymentId}/success`);
  }

  async function cancelWithRefund(bookingId: string, refundMinor: bigint) {
    const req = await h.call("POST", `/me/bookings/${bookingId}/cancellation-request`, {
      session: alice,
      body: { reason: "Plans changed" },
    });
    expect(req.statusCode).toBe(200);
    const res = await h.call("POST", `/admin/bookings/${bookingId}/cancellation-decision`, {
      session: owner,
      body: {
        approve: true,
        expectedStatus: "CANCELLATION_REQUESTED",
        reason: "Within the free cancellation window",
        refund: { amountMinor: Number(refundMinor), currency: "BDT" },
      },
    });
    expect(res.statusCode).toBe(200);
    return res.json();
  }

  beforeAll(async () => {
    h = await createHarness({
      PAYMENT_PROVIDER: "simulator",
      PUBLIC_BASE_URL: "http://localhost:3000",
      SETTINGS_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
    });
    alice = await h.register("alice-gcr@example.com");
    owner = await h.staff("owner");
  }, 120_000);
  afterAll(() => h?.close());

  it("credits a fully gift-card-paid booking back to the card and closes it as REFUNDED", async () => {
    const { id, total } = await holdRoom();
    const c = await card(total);
    expect((await apply(id, c.code)).json().bookingStatus).toBe("CONFIRMED");
    expect(await balance(c.id)).toBe(0n);

    const detail = await cancelWithRefund(id, total);
    expect(detail.status).toBe("REFUNDED");
    expect(detail.refunds).toHaveLength(1);
    expect(detail.refunds[0]).toMatchObject({
      status: "PAID",
      providerRef: "GIFT_CARD",
      giftCardLast4: c.code.slice(-4),
      amount: { amountMinor: Number(total) },
    });
    expect(await balance(c.id)).toBe(total);
    const kinds = (
      await h.db.giftCardTxn.findMany({ where: { giftCardId: c.id }, orderBy: { id: "asc" } })
    ).map((t) => t.kind);
    expect(kinds).toEqual(["ISSUE", "REDEEM", "REFUND"]);
    const ev = await h.db.outboxEvent.findFirstOrThrow({
      where: { eventType: "booking.cancelled", aggregateId: id },
    });
    expect(ev.payload).toMatchObject({
      refundMinor: total.toString(),
      giftCardMinor: total.toString(),
    });
  });

  it("splits a refund: the card share first, the rest left for finance", async () => {
    const { id, total } = await holdRoom();
    const part = total / 4n;
    const c = await card(part);
    await apply(id, c.code);
    await payRest(id);
    expect((await h.call("GET", `/me/bookings/${id}`, { session: alice })).json().status).toBe(
      "CONFIRMED",
    );

    const detail = await cancelWithRefund(id, total);
    expect(detail.status).toBe("REFUND_PENDING");
    const byKind = Object.fromEntries(
      detail.refunds.map(
        (r: { giftCardLast4: string | null; amount: { amountMinor: number }; status: string }) => [
          r.giftCardLast4 ? "card" : "manual",
          r,
        ],
      ),
    );
    expect(byKind.card).toMatchObject({ status: "PAID", amount: { amountMinor: Number(part) } });
    expect(byKind.manual).toMatchObject({
      status: "PENDING",
      amount: { amountMinor: Number(total - part) },
    });
    expect(await balance(c.id)).toBe(part);

    // Finance pays the rest; the booking then becomes REFUNDED.
    const manual = await h.db.refund.findFirstOrThrow({
      where: { publicId: byKind.manual.id },
    });
    const paid = await h.call("POST", `/admin/refunds/${manual.publicId}/paid`, {
      session: owner,
      body: { providerRef: "BANK-TEST-1" },
    });
    expect(paid.statusCode).toBe(204);
    const b = await h.db.booking.findFirstOrThrow({ where: { publicId: id } });
    expect(b.status).toBe("REFUNDED");
  });

  it("a partial refund smaller than the card share all goes to the card", async () => {
    const { id, total } = await holdRoom();
    const c = await card(total);
    await apply(id, c.code);
    const detail = await cancelWithRefund(id, total / 2n);
    expect(detail.status).toBe("REFUNDED");
    expect(await balance(c.id)).toBe(total / 2n);
  });

  it("does not credit a voided card; its share stays a manual refund", async () => {
    const { id, total } = await holdRoom();
    const c = await card(total);
    await apply(id, c.code);
    await h.db.giftCard.update({ where: { id: c.id }, data: { status: "VOID", balanceMinor: 0n } });

    const detail = await cancelWithRefund(id, total);
    expect(detail.status).toBe("REFUND_PENDING");
    expect(detail.refunds).toHaveLength(1);
    expect(detail.refunds[0]).toMatchObject({ status: "PENDING", giftCardLast4: null });
    expect(await balance(c.id)).toBe(0n);
  });

  it("refuses to mark a gift card refund as paid again", async () => {
    const { id, total } = await holdRoom();
    const c = await card(total);
    await apply(id, c.code);
    const detail = await cancelWithRefund(id, total);
    const res = await h.call("POST", `/admin/refunds/${detail.refunds[0].id}/paid`, {
      session: owner,
      body: { providerRef: "BANK-TEST-2" },
    });
    expect(res.statusCode).toBe(409);
  });
});
