/* Offers, ads, orders and gift cards against MySQL 8.4 (ADR-0032). */
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EmailService, type OutgoingEmail } from "../email/email.service";
import { OutboxDispatcher } from "../email/outbox-dispatcher.service";
import { OrderService } from "../commerce/order.service";
import { ADMIN_URL, createHarness, type Harness, type Session } from "./int-harness";

const ALERTS = "pegah.com.bd@gmail.com";
const buyer = { name: "Farzana Karim", email: "farzana@example.com", phone: "+8801711000000" };

describe.skipIf(!ADMIN_URL)("offers, ads, orders and gift cards against MySQL 8.4", () => {
  let h: Harness;
  let owner: Session;
  let customer: Session;
  let mediaKey = "";
  let offerId = "";
  const sent: OutgoingEmail[] = [];

  beforeAll(async () => {
    h = await createHarness({
      PAYMENT_PROVIDER: "simulator",
      PUBLIC_BASE_URL: "http://localhost:3000",
      EMAIL_TRANSPORT: "none",
      SETTINGS_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
    });
    const email = h.app.get(EmailService);
    const original = email.send.bind(email);
    email.send = async (msg) => {
      sent.push(msg);
      return original(msg);
    };
    owner = await h.staff("owner");
    customer = await h.register("buyer@example.com");
    const img = await sharp({
      create: { width: 900, height: 600, channels: 3, background: { r: 240, g: 140, b: 40 } },
    })
      .jpeg()
      .toBuffer();
    const up = await h.call("POST", "/admin/media?alt=Beach%20at%20sunset", {
      session: owner,
      headers: { "content-type": "image/jpeg" },
      body: img,
    });
    mediaKey = up.json().media.key;
  }, 120_000);
  afterAll(() => h?.close());

  const drain = () => h.app.get(OutboxDispatcher).drain();

  const offerBody = {
    titleEn: "Cox's Bazar 3 days",
    titleBn: "কক্সবাজার ৩ দিন",
    summaryEn: "Sea-view hotel, breakfast and transfers.",
    summaryBn: "সমুদ্রমুখী হোটেল, নাশতা ও যাতায়াত।",
    detailsEn: "Two nights at a sea-view hotel with breakfast and airport transfers.",
    detailsBn: "সমুদ্রমুখী হোটেলে দুই রাত, নাশতা ও বিমানবন্দর যাতায়াত।",
    priceMinor: 1_200_000,
    originalPriceMinor: 1_500_000,
    heroMedia: null as string | null,
    validUntil: null,
    stock: 2,
    status: "PUBLISHED",
    sortOrder: 0,
  };

  it("lets staff create offers and ads that the website shows", async () => {
    const created = await h.call("POST", "/admin/offers", {
      session: owner,
      body: { ...offerBody, heroMedia: mediaKey, slug: "coxs-3-days" },
    });
    expect(created.statusCode).toBe(201);
    offerId = created.json().offer.id;
    const draft = await h.call("POST", "/admin/offers", {
      session: owner,
      body: { ...offerBody, slug: "secret-draft", status: "DRAFT" },
    });
    expect(draft.statusCode).toBe(201);

    const list = (await h.call("GET", "/offers")).json();
    expect(list.items.map((o: { slug: string }) => o.slug)).toEqual(["coxs-3-days"]);
    const one = (await h.call("GET", "/offers/coxs-3-days")).json();
    expect(one).toMatchObject({ available: true, remaining: 2, price: { amountMinor: 1_200_000 } });
    expect(one.hero.url).toBe(`/media/${mediaKey}`);
    expect((await h.call("GET", "/offers/secret-draft")).statusCode).toBe(404);

    const ad = await h.call("POST", "/admin/ads", {
      session: owner,
      body: {
        titleEn: "Eid sale",
        titleBn: "ঈদ সেল",
        textEn: "Up to 20% off",
        textBn: "২০% পর্যন্ত ছাড়",
        media: mediaKey,
        linkHref: "/offers",
        placement: "HOME_TOP",
        startsAt: null,
        endsAt: null,
        active: true,
        sortOrder: 0,
      },
    });
    expect(ad.statusCode).toBe(201);
    await h.call("POST", "/admin/ads", {
      session: owner,
      body: {
        titleEn: "Expired",
        titleBn: "মেয়াদোত্তীর্ণ",
        textEn: "",
        textBn: "",
        media: mediaKey,
        linkHref: "",
        placement: "HOME_TOP",
        startsAt: null,
        endsAt: new Date(Date.now() - 60_000).toISOString(),
        active: true,
        sortOrder: 1,
      },
    });
    const live = (await h.call("GET", "/ads?placement=HOME_TOP")).json();
    expect(live.items.map((a: { titleEn: string }) => a.titleEn)).toEqual(["Eid sale"]);
    expect((await h.call("GET", "/ads?placement=OFFERS_TOP")).json().items).toEqual([]);
  });

  it("sells an offer at the server price, reserves stock, and alerts staff by email", async () => {
    const wrong = await h.call("POST", "/me/orders/offer", {
      session: customer,
      body: { offerId, quantity: 1, buyer, expectedTotal: { amountMinor: 100, currency: "BDT" } },
    });
    expect(wrong.statusCode).toBe(409);

    sent.length = 0;
    const res = await h.call("POST", "/me/orders/offer", {
      session: customer,
      body: {
        offerId,
        quantity: 2,
        buyer,
        note: "Window seat please",
        expectedTotal: { amountMinor: 2_400_000, currency: "BDT" },
      },
    });
    expect(res.statusCode).toBe(201);
    const order = res.json();
    expect(order).toMatchObject({
      kind: "OFFER",
      status: "PENDING_PAYMENT",
      total: { amountMinor: 2_400_000 },
    });
    expect(order.reference).toMatch(/^PO-/);

    const soldOut = await h.call("POST", "/me/orders/offer", {
      session: customer,
      body: {
        offerId,
        quantity: 1,
        buyer,
        expectedTotal: { amountMinor: 1_200_000, currency: "BDT" },
      },
    });
    expect(soldOut.statusCode).toBe(409);
    expect((await h.call("GET", "/offers/coxs-3-days")).json()).toMatchObject({
      available: false,
      remaining: 0,
    });

    await drain();
    expect(sent.find((m) => m.to === ALERTS)?.subject).toContain(order.reference);
    expect(sent.find((m) => m.to === buyer.email)?.template).toBe("order-received");

    // Offline payment recorded by staff.
    sent.length = 0;
    const paid = await h.call("POST", `/admin/orders/${order.id}/mark-paid`, {
      session: owner,
      body: { reference: "bKash TrxID 8N7K2Q" },
    });
    expect(paid.json()).toMatchObject({ status: "PAID", paidOffline: "bKash TrxID 8N7K2Q" });
    const again = await h.call("POST", `/admin/orders/${order.id}/mark-paid`, {
      session: owner,
      body: { reference: "twice" },
    });
    expect(again.statusCode).toBe(409);
    await drain();
    expect(sent.map((m) => m.template).sort()).toEqual(["order-paid", "staff-order-paid"]);
  });

  it("gives offer stock back when an unpaid order expires", async () => {
    await h.call("PUT", `/admin/offers/${offerId}`, {
      session: owner,
      body: { ...offerBody, heroMedia: mediaKey, stock: 3 },
    });
    const res = await h.call("POST", "/me/orders/offer", {
      session: customer,
      body: {
        offerId,
        quantity: 1,
        buyer,
        expectedTotal: { amountMinor: 1_200_000, currency: "BDT" },
      },
    });
    expect((await h.call("GET", "/offers/coxs-3-days")).json().remaining).toBe(0);
    await h.app.get(OrderService).expireDue(new Date(Date.now() + 49 * 60 * 60_000));
    const after = await h.call("GET", `/me/orders/${res.json().id}`, { session: customer });
    expect(after.json().status).toBe("EXPIRED");
    expect((await h.call("GET", "/offers/coxs-3-days")).json().remaining).toBe(1);
  });

  it("sells a gift card for someone else, delivers the code only to them, and checks its balance", async () => {
    const res = await h.call("POST", "/me/orders/gift-card", {
      session: customer,
      body: {
        amountTaka: 5000,
        buyer,
        forSelf: false,
        recipientName: "Rafi Ahmed",
        recipientEmail: "rafi@example.com",
        message: "Happy birthday!",
      },
    });
    expect(res.statusCode).toBe(201);
    const order = res.json();
    expect(order).toMatchObject({ kind: "GIFT_CARD", recipient: { email: "rafi@example.com" } });

    // Online payment through the simulator, the same path as SSLCOMMERZ.
    const ps = await h.call("POST", `/me/orders/${order.id}/payment-session`, {
      session: customer,
    });
    expect(ps.statusCode).toBe(201);
    sent.length = 0;
    const done = await h.call("POST", `/payments/simulator/${ps.json().paymentId}/success`);
    expect(done.statusCode).toBe(303);
    expect(done.headers.location).toBe(
      `http://localhost:3000/account/orders/${order.id}?payment=success`,
    );
    const paid = (await h.call("GET", `/me/orders/${order.id}`, { session: customer })).json();
    expect(paid).toMatchObject({ status: "PAID", giftCard: { balance: { amountMinor: 500_000 } } });

    await drain();
    const delivery = sent.find((m) => m.template === "gift-card")!;
    expect(delivery.to).toBe("rafi@example.com");
    expect(delivery.text).toContain("Happy birthday!");
    const code = /([A-HJ-NP-Z2-9]{4}-){3}[A-HJ-NP-Z2-9]{4}/.exec(delivery.text)![0];
    // The buyer and staff never receive the code.
    for (const m of sent.filter((x) => x.template !== "gift-card"))
      expect(m.text).not.toContain(code);
    // The database never holds it in clear.
    const card = await h.db.giftCard.findFirstOrThrow({
      where: { recipientEmail: "rafi@example.com" },
    });
    expect(
      JSON.stringify(card, (_k, v) => (typeof v === "bigint" ? v.toString() : v)),
    ).not.toContain(code.replaceAll("-", ""));

    const balance = await h.call("GET", `/gift-cards/balance?code=${code.toLowerCase()}`);
    expect(balance.json()).toMatchObject({ balance: { amountMinor: 500_000 }, usable: true });
    expect((await h.call("GET", "/gift-cards/balance?code=AAAA-BBBB-CCCC-DDDD")).statusCode).toBe(
      404,
    );

    // Void: the balance is gone and the code stops working.
    const voided = await h.call("POST", `/admin/gift-cards/${card.publicId}/void`, {
      session: owner,
      body: { reason: "Reported lost by the customer" },
    });
    expect(voided.json().giftCard).toMatchObject({ status: "VOID", balance: { amountMinor: 0 } });
    expect((await h.call("GET", `/gift-cards/balance?code=${code}`)).statusCode).toBe(404);
  });

  it("lets finance issue a gift card by hand and keeps a ledger", async () => {
    const finance = await h.staff("finance");
    const issued = await h.call("POST", "/admin/gift-cards", {
      session: finance,
      body: {
        amountTaka: 1000,
        recipientName: "Nadia Islam",
        recipientEmail: "nadia@example.com",
        reason: "Apology for a delayed transfer",
      },
    });
    expect(issued.statusCode).toBe(201);
    expect(issued.json().giftCard.txns).toEqual([
      expect.objectContaining({ kind: "ISSUE", amount: { amountMinor: 100_000, currency: "BDT" } }),
    ]);
    const support = await h.staff("support");
    const denied = await h.call("POST", "/admin/gift-cards", {
      session: support,
      body: {
        amountTaka: 1000,
        recipientName: "X Y",
        recipientEmail: "x@example.com",
        reason: "no",
      },
    });
    expect(denied.statusCode).toBe(403);
  });

  it("refuses a payment row that points at neither or both a booking and an order", async () => {
    await expect(
      h.db
        .$executeRaw`INSERT INTO payments (public_id, provider, provider_txn_id, amount_minor, currency, status, created_at, updated_at)
        VALUES ('01J0000000000000000000TEST', 'simulator', 'x-check', 100, 'BDT', 'INITIATED', NOW(3), NOW(3))`,
    ).rejects.toThrow();
  });
});
