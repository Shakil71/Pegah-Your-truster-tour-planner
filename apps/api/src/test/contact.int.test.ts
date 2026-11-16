/* Contact form and website menu settings (ADR-0041) against MySQL 8.4. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ADMIN_URL, createHarness, type Harness } from "./int-harness";

const message = {
  topic: "BOOKING",
  name: "Rahim Uddin",
  email: "Rahim@Example.com",
  phone: "+880 1711-000000",
  travelDate: "2026-12-20",
  guests: 4,
  message: "We would like a sea-view room in Cox's Bazar for two nights.",
};

describe.skipIf(!ADMIN_URL)("contact form and menu settings", () => {
  let h: Harness;

  beforeAll(async () => {
    h = await createHarness();
  }, 120_000);
  afterAll(() => h?.close());

  it("accepts a message from a visitor, queues both emails and audits it", async () => {
    const res = await h.call("POST", "/contact", { body: message, remoteAddress: "10.0.0.1" });
    expect(res.statusCode).toBe(201);
    const { reference } = res.json() as { reference: string };
    expect(reference).toMatch(/^PC-[2-9A-HJ-NP-Z]{6}$/);

    const row = await h.db.contactMessage.findUniqueOrThrow({ where: { reference } });
    expect(row).toMatchObject({
      topic: "BOOKING",
      status: "NEW",
      email: "rahim@example.com",
      phone: "+8801711000000",
      guests: 4,
      userId: null,
    });
    expect(row.travelDate?.toISOString().slice(0, 10)).toBe("2026-12-20");

    const events = await h.db.outboxEvent.findMany({ where: { aggregateId: row.publicId } });
    expect(events.map((e) => e.eventType).sort()).toEqual([
      "contact.created.customer",
      "contact.created.staff",
    ]);
    const audit = await h.db.auditEvent.findFirst({
      where: { action: "contact.created", targetId: row.publicId },
    });
    expect(audit?.actorType).toBe("SYSTEM");
  });

  it("links a signed-in customer's message to their account", async () => {
    const customer = await h.register(`contact-${Date.now()}@pegah.test`);
    const res = await h.call("POST", "/contact", {
      session: customer,
      body: { ...message, topic: "RESERVATION", travelDate: undefined, guests: undefined },
      remoteAddress: "10.0.0.2",
    });
    expect(res.statusCode).toBe(201);
    const row = await h.db.contactMessage.findUniqueOrThrow({
      where: { reference: res.json().reference as string },
    });
    expect(row.userId).not.toBeNull();
  });

  it("rejects bad input and other websites, and stores nothing from bots", async () => {
    const short = await h.call("POST", "/contact", {
      body: { ...message, message: "hi" },
      remoteAddress: "10.0.0.3",
    });
    expect(short.statusCode).toBe(400);

    const foreign = await h.call("POST", "/contact", {
      body: message,
      headers: { origin: "https://evil.example" },
      remoteAddress: "10.0.0.3",
    });
    expect(foreign.statusCode).toBe(403);

    const before = await h.db.contactMessage.count();
    const bot = await h.call("POST", "/contact", {
      body: { ...message, website: "" },
      remoteAddress: "10.0.0.3",
    });
    expect(bot.statusCode).toBe(201);
    const filled = await h.call("POST", "/contact", {
      body: { ...message, website: "x" },
      remoteAddress: "10.0.0.3",
    });
    expect(filled.statusCode).toBe(400);
    expect(await h.db.contactMessage.count()).toBe(before + 1);
  });

  it("limits how often one address can send", async () => {
    const codes: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await h.call("POST", "/contact", { body: message, remoteAddress: "10.0.0.9" });
      codes.push(res.statusCode);
    }
    expect(codes.slice(0, 5)).toEqual([201, 201, 201, 201, 201]);
    expect(codes[5]).toBe(429);
  });

  it("lets support staff list and update messages, and refuses others", async () => {
    const support = await h.staff("support");
    const list = await h.call("GET", "/admin/contact-messages?status=NEW", { session: support });
    expect(list.statusCode).toBe(200);
    const body = list.json() as {
      items: Array<{ id: string; status: string; name: string }>;
      counts: { NEW: number };
    };
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.counts.NEW).toBe(body.items.length);

    const first = body.items[0]!;
    const upd = await h.call("PUT", `/admin/contact-messages/${first.id}`, {
      session: support,
      body: { status: "IN_PROGRESS", staffNote: "Called back with options." },
    });
    expect(upd.statusCode).toBe(200);
    expect(upd.json()).toMatchObject({
      status: "IN_PROGRESS",
      staffNote: "Called back with options.",
      handledBy: "support person",
    });
    const audit = await h.db.auditEvent.findFirst({
      where: { action: "contact.updated", targetId: first.id },
    });
    expect(audit?.actorType).toBe("STAFF");

    const content = await h.staff("content");
    expect((await h.call("GET", "/admin/contact-messages", { session: content })).statusCode).toBe(
      403,
    );
    expect((await h.call("GET", "/admin/contact-messages")).statusCode).toBe(401);
  });

  it("keeps stays, flights and visa out of the menu until the owner turns them on", async () => {
    const site = await h.call("GET", "/site");
    expect(site.json().menu).toEqual({ showStays: false, showFlights: false, showVisa: false });

    const owner = await h.staff("owner");
    const saved = await h.call("PUT", "/admin/settings/menu", {
      session: owner,
      body: { showStays: true, showFlights: false, showVisa: true },
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json().menu).toEqual({ showStays: true, showFlights: false, showVisa: true });
    expect((await h.call("GET", "/site")).json().menu).toEqual({
      showStays: true,
      showFlights: false,
      showVisa: true,
    });

    const support = await h.staff("support");
    const refused = await h.call("PUT", "/admin/settings/menu", {
      session: support,
      body: { showStays: false, showFlights: false, showVisa: false },
    });
    expect(refused.statusCode).toBe(403);
  });
});
