/* Phase 6 growth tools against MySQL 8.4: promotions in quotes and bookings,
 * redemption limits, sales report + CSV, content pages. */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HoldExpiryService } from "../booking/hold-expiry.service";
import { addDays, dhakaToday, formatCalendarDate } from "../common/time";
import { ADMIN_URL, createHarness, type Harness, type Session } from "./int-harness";

describe.skipIf(!ADMIN_URL)("promotions, reports and content against MySQL 8.4", () => {
  let h: Harness;
  let content: Session;
  let ops: Session;
  let alice: Session;
  const day = (n: number) => formatCalendarDate(addDays(dhakaToday(), n));
  const nowIso = () => new Date(Date.now() - 60_000).toISOString();
  const laterIso = () => new Date(Date.now() + 30 * 86_400_000).toISOString();

  function promo(overrides: Record<string, unknown> = {}) {
    return {
      name: "Monsoon 10%",
      kind: "PERCENT",
      percentBps: 1000,
      amount: null,
      minSpend: { amountMinor: 1_000_000, currency: "BDT" },
      maxDiscount: { amountMinor: 150_000, currency: "BDT" },
      scope: "HOTEL",
      startsAt: nowIso(),
      endsAt: laterIso(),
      maxRedemptions: 2,
      perCustomerLimit: 1,
      status: "ACTIVE",
      ...overrides,
    };
  }

  async function quote(code?: string, session?: Session) {
    const q = `/quotes/hotel?roomId=${h.roomId}&checkIn=${day(10)}&checkOut=${day(12)}&adults=1&rooms=1${code ? `&promoCode=${code}` : ""}`;
    return (await h.call("GET", q, session ? { session } : {})).json();
  }

  async function book(session: Session, code: string | undefined, expectedTotal: unknown) {
    return h.call("POST", "/bookings", {
      session,
      headers: { "idempotency-key": randomUUID() },
      body: {
        product: "HOTEL",
        roomId: h.roomId,
        checkIn: day(10),
        checkOut: day(12),
        rooms: 1,
        adults: 1,
        children: 0,
        contact: { name: "Alice Rahman", email: "alice@example.com", phone: "+8801711000000" },
        guests: [{ fullName: "Alice Rahman", ageGroup: "ADULT" }],
        expectedTotal,
        ...(code ? { promoCode: code } : {}),
      },
    });
  }

  beforeAll(async () => {
    h = await createHarness({
      PAYMENT_PROVIDER: "simulator",
      PUBLIC_BASE_URL: "http://localhost:3000",
    });
    [content, ops] = await Promise.all([h.staff("content"), h.staff("operations")]);
    alice = await h.register("alice@example.com");
  }, 120_000);

  afterAll(async () => {
    await h?.close();
  });

  it("creates promotions with permission checks and normalised codes", async () => {
    const forbidden = await h.call("POST", "/admin/promotions", {
      session: ops,
      body: { code: "x10", promotion: promo() },
    });
    expect(forbidden.statusCode).toBe(403);
    const created = await h.call("POST", "/admin/promotions", {
      session: content,
      body: { code: "monsoon10", promotion: promo() },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().promotion).toMatchObject({ code: "MONSOON10", redemptions: 0 });
    const dup = await h.call("POST", "/admin/promotions", {
      session: content,
      body: { code: "MONSOON10", promotion: promo() },
    });
    expect(dup.statusCode).toBe(409);
    const bad = await h.call("POST", "/admin/promotions", {
      session: content,
      body: { code: "BAD1", promotion: promo({ kind: "FIXED", percentBps: 1000 }) },
    });
    expect(bad.statusCode).toBe(400);
  });

  it("discounts the base, recomputes taxes, and keeps the booking total consistent", async () => {
    const plain = await quote();
    // 2 nights × ৳8,500 = ৳17,000 base; 10% = ৳1,700 but capped at ৳1,500.
    const withCode = await quote("monsoon10", alice);
    expect(withCode.promotion).toEqual({ code: "MONSOON10", name: "Monsoon 10%" });
    expect(withCode.price.discount.amountMinor).toBe(150_000);
    // SC 10% and VAT 15% on (17,000 − 1,500) = 15,500 → 1,550 SC, 2,557.50 VAT.
    expect(withCode.price.serviceCharge.amountMinor).toBe(155_000);
    expect(withCode.price.vat.amountMinor).toBe(255_750);
    expect(withCode.price.total.amountMinor).toBe(1_960_750);
    expect(withCode.price.total.amountMinor).toBeLessThan(plain.price.total.amountMinor);

    const wrongExpect = await book(alice, "MONSOON10", plain.price.total);
    expect(wrongExpect.json().type).toBe("/problems/price-changed");
    const ok = await book(alice, "MONSOON10", withCode.price.total);
    expect(ok.statusCode).toBe(201);
    expect(ok.json()).toMatchObject({
      promotionCode: "MONSOON10",
      price: { discount: { amountMinor: 150_000 } },
    });
  });

  it("enforces per-customer and total limits, and frees a redemption when a hold expires", async () => {
    const again = await quote("MONSOON10", alice);
    expect(again.promotion).toBeNull();
    expect(again.promoError).toMatch(/already used/);
    const direct = await book(alice, "MONSOON10", again.price.total);
    expect(direct.json().type).toBe("/problems/promo-not-applicable");

    const bob = await h.register("bob@example.com");
    const bobQuote = await quote("MONSOON10", bob);
    expect((await book(bob, "MONSOON10", bobQuote.price.total)).statusCode).toBe(201);

    const carol = await h.register("carol@example.com");
    const full = await quote("MONSOON10", carol);
    expect(full.promoError).toMatch(/fully used/);

    // Unpaid holds expire and give their redemption back.
    await h.app.get(HoldExpiryService).sweep(new Date(Date.now() + 60 * 60_000));
    const freed = await quote("MONSOON10", carol);
    expect(freed.promotion).not.toBeNull();
  });

  it("rejects codes outside their scope, window or minimum spend", async () => {
    await h.call("POST", "/admin/promotions", {
      session: content,
      body: {
        code: "TOURS500",
        promotion: promo({
          kind: "FIXED",
          percentBps: null,
          amount: { amountMinor: 50_000, currency: "BDT" },
          maxDiscount: null,
          scope: "TOUR",
        }),
      },
    });
    expect((await quote("TOURS500")).promoError).toMatch(/only for tours/);
    await h.call("POST", "/admin/promotions", {
      session: content,
      body: {
        code: "BIGSPEND",
        promotion: promo({ minSpend: { amountMinor: 99_999_900, currency: "BDT" } }),
      },
    });
    expect((await quote("BIGSPEND")).promoError).toMatch(/Spend at least/);
    expect((await quote("NOSUCHCODE")).promoError).toMatch(/recognise/);
    const list = await h.call("GET", "/admin/promotions", { session: content });
    const monsoon = list.json().items.find((p: { code: string }) => p.code === "MONSOON10");
    // The sweep above expired every unpaid promo booking, so nothing is redeemed now.
    expect(monsoon).toMatchObject({ redemptions: 0, discountGiven: { amountMinor: 0 } });
    // Pause it: quotes stop applying it.
    const paused = await h.call("PUT", `/admin/promotions/${monsoon.id}`, {
      session: content,
      body: promo({ status: "PAUSED" }),
    });
    expect(paused.json().promotion.status).toBe("PAUSED");
    expect((await quote("MONSOON10")).promoError).toMatch(/not active/);
  });

  it("reports sales and exports a safe CSV", async () => {
    const report = await h.call("GET", `/admin/reports/sales?from=${day(0)}&to=${day(0)}`, {
      session: ops,
    });
    expect(report.statusCode).toBe(200);
    expect(report.json().totals.bookings).toBeGreaterThanOrEqual(2);
    expect(report.json().byDay).toHaveLength(1);
    const csv = await h.call("GET", `/admin/reports/bookings.csv?from=${day(0)}&to=${day(0)}`, {
      session: ops,
    });
    expect(csv.headers["content-type"]).toContain("text/csv");
    expect(csv.headers["content-disposition"]).toContain("attachment");
    const lines = csv.body.replace(/^﻿/, "").trim().split("\r\n");
    expect(lines[0]).toContain("reference,created_at_utc,status");
    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(csv.body).toContain("MONSOON10");
    const contentUser = await h.call("GET", `/admin/reports/sales?from=${day(0)}&to=${day(0)}`, {
      session: content,
    });
    expect(contentUser.statusCode).toBe(403);
  });

  it("publishes content pages only when published", async () => {
    const created = await h.call("POST", "/admin/pages", {
      session: content,
      body: {
        slug: "terms",
        title: "Terms of service",
        summary: "The rules of using Pegah.",
        body: "## Bookings\n\nA booking is confirmed only after payment is verified.",
        status: "DRAFT",
      },
    });
    expect(created.statusCode).toBe(201);
    expect((await h.call("GET", "/pages/terms")).statusCode).toBe(404);
    await h.call("PUT", "/admin/pages/terms", {
      session: content,
      body: {
        title: "Terms of service",
        summary: "The rules of using Pegah.",
        body: "## Bookings\n\nA booking is confirmed only after payment is verified.",
        status: "PUBLISHED",
      },
    });
    const pub = await h.call("GET", "/pages/terms");
    expect(pub.json()).toMatchObject({ title: "Terms of service" });
    expect(pub.json().body).toContain("## Bookings");
  });
});
