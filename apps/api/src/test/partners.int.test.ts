/* Phase 7 partner portal against MySQL 8.4: suppliers manage only their own
 * inventory and see their reservations; agents book for clients and earn
 * commission; admin manages partners. */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { newPublicId } from "../common/ids";
import { addDays, dhakaToday, formatCalendarDate } from "../common/time";
import { EmailService, type OutgoingEmail } from "../email/email.service";
import { OutboxDispatcher } from "../email/outbox-dispatcher.service";
import { ADMIN_URL, createHarness, type Harness, type Session } from "./int-harness";

describe.skipIf(!ADMIN_URL)("partner portal against MySQL 8.4", () => {
  let h: Harness;
  let owner: Session;
  let supplier: Session;
  let agent: Session;
  let agentPartnerId = "";
  let otherRoomId = "";
  const sent: OutgoingEmail[] = [];
  const day = (n: number) => formatCalendarDate(addDays(dhakaToday(), n));

  async function partnerLogin(email: string, password: string): Promise<Session> {
    const res = await h.call("POST", "/partner/auth/login", { body: { email, password } });
    expect(res.statusCode).toBe(200);
    const cookie = [res.headers["set-cookie"]]
      .flat()
      .map(String)
      .find((c) => c.startsWith("pg_partner_sid="))!
      .split(";")[0]!;
    return { cookie, csrf: res.json().csrfToken };
  }

  beforeAll(async () => {
    h = await createHarness({
      PAYMENT_PROVIDER: "simulator",
      PUBLIC_BASE_URL: "http://localhost:3000",
      EMAIL_TRANSPORT: "none",
    });
    const email = h.app.get(EmailService);
    const original = email.send.bind(email);
    email.send = async (msg) => {
      sent.push(msg);
      return original(msg);
    };
    owner = await h.staff("owner");
    // A second hotel nobody assigns to the supplier.
    const dest = await h.db.destination.findFirstOrThrow();
    const other = await h.db.hotel.create({
      data: {
        publicId: newPublicId(),
        slug: "other-hotel",
        name: "Other Hotel",
        destinationId: dest.id,
        addressLine: "x",
        summary: "Other hotel summary",
        cancellationPolicy: "Other policy text",
        status: "PUBLISHED",
      },
    });
    const room = await h.db.hotelRoom.create({
      data: {
        publicId: newPublicId(),
        hotelId: other.id,
        name: "Other Room",
        description: "x",
        maxAdults: 2,
        bedType: "Queen",
      },
    });
    otherRoomId = room.publicId;
  }, 120_000);

  afterAll(async () => {
    await h?.close();
  });

  it("lets only staff with partner:manage create partners", async () => {
    const ops = await h.staff("operations");
    const denied = await h.call("GET", "/admin/partners", { session: ops });
    expect(denied.statusCode).toBe(403);

    const sup = await h.call("POST", "/admin/partners", {
      session: owner,
      body: {
        kind: "SUPPLIER",
        name: "Hill Stays Ltd",
        email: "ops@hillstays.example",
        phone: null,
        commissionBps: 0,
        member: {
          fullName: "Rumana Hill",
          email: "rumana@hillstays.example",
          password: "supplier-pass-123",
        },
      },
    });
    expect(sup.statusCode).toBe(201);
    const own = await h.call("PUT", `/admin/partners/${sup.json().partner.id}/ownership`, {
      session: owner,
      body: { hotelSlugs: ["it-hotel"], tourSlugs: ["it-tour"] },
    });
    expect(own.json().partner).toMatchObject({
      hotels: [{ slug: "it-hotel" }],
      tours: [{ slug: "it-tour" }],
    });

    const ag = await h.call("POST", "/admin/partners", {
      session: owner,
      body: {
        kind: "AGENT",
        name: "Sky Travels",
        email: "desk@skytravels.example",
        phone: null,
        commissionBps: 1000,
        member: {
          fullName: "Arif Sky",
          email: "arif@skytravels.example",
          password: "agent-pass-12345",
        },
      },
    });
    expect(ag.statusCode).toBe(201);
    agentPartnerId = ag.json().partner.id;
    supplier = await partnerLogin("rumana@hillstays.example", "supplier-pass-123");
    agent = await partnerLogin("arif@skytravels.example", "agent-pass-12345");
  });

  it("keeps portals separate from customer and staff sign-in", async () => {
    const asCustomer = await h.call("POST", "/auth/login", {
      body: { email: "rumana@hillstays.example", password: "supplier-pass-123" },
    });
    expect(asCustomer.statusCode).toBe(401);
    const asStaff = await h.call("POST", "/staff/auth/login", {
      body: { email: "rumana@hillstays.example", password: "supplier-pass-123" },
    });
    expect(asStaff.statusCode).toBe(401);
    const session = await h.call("GET", "/partner/auth/session", { session: supplier });
    expect(session.json().user).toMatchObject({
      kind: "PARTNER",
      partner: { kind: "SUPPLIER", name: "Hill Stays Ltd" },
    });
  });

  it("shows a supplier only its own hotels and tours, and lets it manage their inventory", async () => {
    const ov = await h.call("GET", "/partner/overview", { session: supplier });
    expect(ov.json().supplier.hotels.map((x: { slug: string }) => x.slug)).toEqual(["it-hotel"]);
    expect(ov.json().supplier.tours[0].departures).toHaveLength(1);
    const roomId = ov.json().supplier.hotels[0].rooms[0].id;

    const set = await h.call("PUT", `/partner/rooms/${roomId}/calendar`, {
      session: supplier,
      body: { from: day(0), to: day(5), total: 4 },
    });
    expect(set.json()).toEqual({ datesUpdated: 6 });
    const notMine = await h.call("PUT", `/partner/rooms/${otherRoomId}/calendar`, {
      session: supplier,
      body: { from: day(0), to: day(5), total: 4 },
    });
    expect(notMine.statusCode).toBe(404);
    const dep = ov.json().supplier.tours[0].departures[0];
    const closed = await h.call("PATCH", `/partner/departures/${dep.id}`, {
      session: supplier,
      body: { status: "CLOSED" },
    });
    expect(closed.json().departure.status).toBe("CLOSED");
    await h.call("PATCH", `/partner/departures/${dep.id}`, {
      session: supplier,
      body: { status: "SCHEDULED" },
    });

    const audit = await h.call("GET", "/admin/audit?action=inventory.", { session: owner });
    expect(audit.json().items[0]).toMatchObject({ actorType: "PARTNER", actorName: "Rumana Hill" });

    // Agents cannot use supplier endpoints, and vice versa.
    expect((await h.call("GET", "/partner/reservations", { session: agent })).statusCode).toBe(403);
    expect((await h.call("GET", "/partner/bookings", { session: supplier })).statusCode).toBe(403);
  });

  it("lets an agent book for a client, earn commission once confirmed, and see a statement", async () => {
    const quote = await h.call(
      "GET",
      `/quotes/hotel?roomId=${h.roomId}&checkIn=${day(10)}&checkOut=${day(12)}&adults=2&rooms=1`,
    );
    const total = quote.json().price.total;
    const res = await h.call("POST", "/partner/bookings", {
      session: agent,
      headers: { "idempotency-key": randomUUID() },
      body: {
        product: "HOTEL",
        roomId: h.roomId,
        checkIn: day(10),
        checkOut: day(12),
        rooms: 1,
        adults: 2,
        children: 0,
        contact: { name: "Client Karim", email: "client@example.com", phone: "+8801911000000" },
        guests: [
          { fullName: "Client Karim", ageGroup: "ADULT" },
          { fullName: "Mina Karim", ageGroup: "ADULT" },
        ],
        expectedTotal: total,
      },
    });
    expect(res.statusCode).toBe(201);
    const booking = res.json();
    const expectedCommission = Math.floor((total.amountMinor * 1000 + 5000) / 10000);
    expect(booking.agent).toEqual({
      name: "Sky Travels",
      commission: { amountMinor: expectedCommission, currency: "BDT" },
    });

    const ps = await h.call("POST", `/partner/bookings/${booking.id}/payment-session`, {
      session: agent,
      body: {},
    });
    const paid = await h.call("POST", `/payments/simulator/${ps.json().paymentId}/success`);
    // The agent returns to the partner portal, not the customer account area.
    expect(paid.statusCode).toBe(303);
    expect(paid.headers.location).toBe(
      `http://localhost:3000/partner/bookings/${booking.id}?payment=success`,
    );
    // Client emails carry no account link: the client has no Pegah account.
    await h.app.get(OutboxDispatcher).drain();
    const mails = sent.filter((m) => m.to === "client@example.com");
    expect(mails.map((m) => m.template)).toEqual(
      expect.arrayContaining(["booking-held", "booking-confirmed"]),
    );
    for (const m of mails) expect(m.text).not.toContain("/account/bookings");
    const confirmed = await h.call("GET", `/partner/bookings/${booking.id}`, { session: agent });
    expect(confirmed.json().status).toBe("CONFIRMED");

    const month = day(0).slice(0, 7);
    const st = await h.call("GET", `/partner/statement?month=${month}`, { session: agent });
    expect(st.json().totals).toMatchObject({
      bookings: 1,
      commissionEarned: { amountMinor: expectedCommission },
    });
    const ov = await h.call("GET", "/partner/overview", { session: agent });
    expect(ov.json().agent.commissionEarned.amountMinor).toBe(expectedCommission);

    // The supplier sees the reservation for its hotel; staff see the agent on the booking.
    const res2 = await h.call("GET", "/partner/reservations", { session: supplier });
    expect(res2.json().items.map((b: { id: string }) => b.id)).toContain(booking.id);
    const staffView = await h.call("GET", `/admin/bookings/${booking.id}`, { session: owner });
    expect(staffView.json().agent.name).toBe("Sky Travels");
  });

  it("signs partner users out immediately when the partner is suspended", async () => {
    const res = await h.call("PUT", `/admin/partners/${agentPartnerId}`, {
      session: owner,
      body: {
        name: "Sky Travels",
        email: "desk@skytravels.example",
        phone: null,
        commissionBps: 1000,
        status: "SUSPENDED",
      },
    });
    expect(res.json().partner.status).toBe("SUSPENDED");
    expect((await h.call("GET", "/partner/overview", { session: agent })).statusCode).toBe(401);
    const relog = await h.call("POST", "/partner/auth/login", {
      body: { email: "arif@skytravels.example", password: "agent-pass-12345" },
    });
    expect(relog.statusCode).toBe(401);
  });
});
