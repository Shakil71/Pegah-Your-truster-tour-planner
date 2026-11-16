/* Deleting and showing/hiding listings from the console, against MySQL 8.4. */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addDays, dhakaToday, formatCalendarDate } from "../common/time";
import { ADMIN_URL, createHarness, type Harness, type Session } from "./int-harness";

describe.skipIf(!ADMIN_URL)("console delete and show/hide against MySQL 8.4", () => {
  let h: Harness;
  let owner: Session;
  const day = (n: number) => formatCalendarDate(addDays(dhakaToday(), n));

  beforeAll(async () => {
    h = await createHarness();
    owner = await h.staff("owner");
  }, 120_000);
  afterAll(() => h?.close());

  const visibility = (kind: string, key: string, visible: boolean, session = owner) =>
    h.call("PUT", `/admin/manage/${kind}/${key}/visibility`, { session, body: { visible } });

  it("hides and shows a hotel, a room and a tour on the website", async () => {
    const hidden = await visibility("hotel", "it-hotel", false);
    expect(hidden.statusCode).toBe(200);
    expect(hidden.json()).toEqual({ visible: false });
    expect((await h.call("GET", "/hotels/it-hotel")).statusCode).toBe(404);
    expect((await visibility("hotel", "it-hotel", true)).statusCode).toBe(200);
    expect((await h.call("GET", "/hotels/it-hotel")).statusCode).toBe(200);

    expect((await visibility("room", h.roomId, false)).statusCode).toBe(200);
    const room = await h.db.hotelRoom.findUniqueOrThrow({ where: { publicId: h.roomId } });
    expect(room.isActive).toBe(false);
    await visibility("room", h.roomId, true);

    await visibility("tour", "it-tour", false);
    expect((await h.call("GET", "/tours/it-tour")).statusCode).toBe(404);
    await visibility("tour", "it-tour", true);
    expect((await h.call("GET", "/tours/it-tour")).statusCode).toBe(200);

    expect((await visibility("hotel", "no-such-hotel", false)).statusCode).toBe(404);
    // Messages can be deleted but have no show/hide.
    const noSwitch = await visibility("contact-message", "x", false);
    expect(noSwitch.statusCode).toBe(422);
    expect(noSwitch.json().type).toMatch(/no-visibility/);
  });

  it("needs the right permission and a staff session", async () => {
    const support = await h.staff("support");
    expect((await visibility("hotel", "it-hotel", false, support)).statusCode).toBe(403);
    expect(
      (await h.call("DELETE", "/admin/manage/hotel/it-hotel", { session: support })).statusCode,
    ).toBe(403);
    const customer = await h.register("someone@example.com");
    expect([401, 403]).toContain(
      (await h.call("DELETE", "/admin/manage/hotel/it-hotel", { session: customer })).statusCode,
    );
    expect(
      (await h.call("DELETE", "/admin/manage/nonsense/it-hotel", { session: owner })).statusCode,
    ).toBe(404);
  });

  it("refuses to delete what bookings use, and deletes the rest with its rooms and dates", async () => {
    // A destination with hotels and tours cannot go.
    const dest = await h.call("DELETE", "/admin/manage/destination/it-dest", { session: owner });
    expect(dest.statusCode).toBe(409);

    // A tour with no bookings goes, departures included.
    const tour = await h.call("DELETE", "/admin/manage/tour/it-tour", { session: owner });
    expect(tour.statusCode).toBe(204);
    expect(await h.db.tour.count({ where: { slug: "it-tour" } })).toBe(0);
    expect(await h.db.tourSchedule.count({ where: { publicId: h.departureId } })).toBe(0);

    // Once a room is booked, the room and its hotel stay (hide them instead).
    const customer = await h.register("booker@example.com");
    const q = `roomId=${h.roomId}&checkIn=${day(10)}&checkOut=${day(11)}&adults=1&rooms=1`;
    const total = (await h.call("GET", `/quotes/hotel?${q}`)).json().price.total;
    const booked = await h.call("POST", "/bookings", {
      session: customer,
      headers: { "idempotency-key": randomUUID() },
      body: {
        product: "HOTEL",
        roomId: h.roomId,
        checkIn: day(10),
        checkOut: day(11),
        rooms: 1,
        adults: 1,
        children: 0,
        contact: { name: "Rina Akter", email: "rina@example.com", phone: "+8801711000000" },
        guests: [{ fullName: "Rina Akter", ageGroup: "ADULT" }],
        expectedTotal: total,
      },
    });
    expect(booked.statusCode).toBe(201);
    const room = await h.call("DELETE", `/admin/manage/room/${h.roomId}`, { session: owner });
    expect(room.statusCode).toBe(409);
    expect(room.json().detail).toMatch(/Hide it instead/);
    expect(
      (await h.call("DELETE", "/admin/manage/hotel/it-hotel", { session: owner })).statusCode,
    ).toBe(409);
    expect(await h.db.hotel.count({ where: { slug: "it-hotel" } })).toBe(1);

    // Every delete is in the audit log.
    const audit = await h.db.auditEvent.findMany({ where: { action: "tour.deleted" } });
    expect(audit).toHaveLength(1);
  });
});
