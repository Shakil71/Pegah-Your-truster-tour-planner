/* Phase 6 back office against MySQL 8.4: catalog, inventory calendar,
 * departures, customers, and the links between modules. */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addDays, dhakaToday, formatCalendarDate } from "../common/time";
import { ADMIN_URL, createHarness, type Harness, type Session } from "./int-harness";

describe.skipIf(!ADMIN_URL)("operations admin against MySQL 8.4", () => {
  let h: Harness;
  let owner: Session;
  let ops: Session;
  let content: Session;
  let support: Session;
  let roomId = "";
  const day = (n: number) => formatCalendarDate(addDays(dhakaToday(), n));

  beforeAll(async () => {
    h = await createHarness();
    [owner, ops, content, support] = await Promise.all([
      h.staff("owner"),
      h.staff("operations"),
      h.staff("content"),
      h.staff("support"),
    ]);
  }, 120_000);

  afterAll(async () => {
    await h?.close();
  });

  it("creates a destination, hotel and room, then sells it on the website once inventory exists", async () => {
    const dest = await h.call("POST", "/admin/destinations", {
      session: content,
      body: {
        slug: "sajek",
        name: "Sajek Valley",
        region: "Rangamati",
        summary: "Cloud-level ridge villages with sunrise viewpoints.",
        status: "PUBLISHED",
        sortOrder: 5,
      },
    });
    expect(dest.statusCode).toBe(201);
    expect(dest.json().destination).toMatchObject({ slug: "sajek", hotelCount: 0 });

    const dup = await h.call("POST", "/admin/destinations", {
      session: content,
      body: {
        slug: "sajek",
        name: "X Y",
        region: "Z Z",
        summary: "Duplicate slug test.",
        status: "DRAFT",
        sortOrder: 0,
      },
    });
    expect(dup.statusCode).toBe(409);

    const hotel = await h.call("POST", "/admin/hotels", {
      session: content,
      body: {
        slug: "ridge-cottages",
        destinationSlug: "sajek",
        name: "Ridge Cottages",
        starRating: 3,
        addressLine: "Ruilui Para, Sajek",
        summary: "Wooden cottages on the ridge facing the sunrise.",
        checkInTime: "13:00",
        checkOutTime: "11:00",
        cancellationPolicy: "Free cancellation up to 3 days before arrival.",
        serviceChargeBps: 0,
        vatBps: 1500,
        status: "PUBLISHED",
      },
    });
    expect(hotel.statusCode).toBe(201);
    expect(hotel.json()).toMatchObject({ slug: "ridge-cottages", roomCount: 0, activeBookings: 0 });

    const room = await h.call("POST", "/admin/hotels/ridge-cottages/rooms", {
      session: content,
      body: {
        name: "Sunrise Cottage",
        description: "Private deck facing east",
        maxAdults: 2,
        maxChildren: 1,
        bedType: "1 Queen",
        sizeSqm: 25,
        isActive: true,
      },
    });
    expect(room.statusCode).toBe(201);
    roomId = room.json().room.id;

    // Published but nothing on sale yet: the website shows no offer.
    const before = await h.call(
      "GET",
      `/hotels/search?destination=sajek&checkIn=${day(5)}&checkOut=${day(7)}`,
    );
    expect(before.json().offers).toHaveLength(0);

    // Content staff cannot set inventory; operations can.
    const forbidden = await h.call("PUT", `/admin/rooms/${roomId}/calendar`, {
      session: content,
      body: { from: day(0), to: day(30), total: 4 },
    });
    expect(forbidden.statusCode).toBe(403);
    const set = await h.call("PUT", `/admin/rooms/${roomId}/calendar`, {
      session: ops,
      body: {
        from: day(0),
        to: day(30),
        total: 4,
        rate: { amountMinor: 650_000, currency: "BDT" },
      },
    });
    expect(set.json()).toEqual({ datesUpdated: 31 });
    // Weekend uplift: Thursday and Friday only.
    const weekend = await h.call("PUT", `/admin/rooms/${roomId}/calendar`, {
      session: ops,
      body: {
        from: day(0),
        to: day(30),
        weekdays: [4, 5],
        rate: { amountMinor: 800_000, currency: "BDT" },
      },
    });
    expect(weekend.json().datesUpdated).toBeGreaterThanOrEqual(8);

    const after = await h.call(
      "GET",
      `/hotels/search?destination=sajek&checkIn=${day(5)}&checkOut=${day(7)}`,
    );
    expect(after.json().offers).toHaveLength(1);
    expect(after.json().offers[0].hotel.slug).toBe("ridge-cottages");

    const cal = await h.call("GET", `/admin/rooms/${roomId}/calendar?from=${day(0)}&days=14`, {
      session: support,
    });
    expect(cal.statusCode).toBe(403); // support has no catalog:read
    const cal2 = await h.call("GET", `/admin/rooms/${roomId}/calendar?from=${day(0)}&days=14`, {
      session: ops,
    });
    expect(cal2.json().days).toHaveLength(14);
    expect(cal2.json().days.every((d: { total: number }) => d.total === 4)).toBe(true);
  });

  it("never lets inventory drop below rooms already held, and links the booking everywhere", async () => {
    const alice = await h.register("alice@example.com");
    const quote = await h.call(
      "GET",
      `/quotes/hotel?roomId=${roomId}&checkIn=${day(5)}&checkOut=${day(7)}&adults=3&rooms=3`,
    );
    const booking = await h.call("POST", "/bookings", {
      session: alice,
      headers: { "idempotency-key": randomUUID() },
      body: {
        product: "HOTEL",
        roomId,
        checkIn: day(5),
        checkOut: day(7),
        rooms: 3,
        adults: 3,
        children: 0,
        contact: { name: "Alice Rahman", email: "alice@example.com", phone: "+8801711000000" },
        guests: [
          { fullName: "Alice Rahman", ageGroup: "ADULT" },
          { fullName: "B Rahman", ageGroup: "ADULT" },
          { fullName: "C Rahman", ageGroup: "ADULT" },
        ],
        expectedTotal: quote.json().price.total,
      },
    });
    expect(booking.statusCode).toBe(201);
    const id = booking.json().id;

    const tooLow = await h.call("PUT", `/admin/rooms/${roomId}/calendar`, {
      session: ops,
      body: { from: day(0), to: day(10), total: 2 },
    });
    expect(tooLow.statusCode).toBe(409);
    expect(tooLow.json().type).toBe("/problems/below-committed");
    expect(tooLow.json().detail).toContain(day(5));

    // Booking detail links to the customer and the product.
    const detail = await h.call("GET", `/admin/bookings/${id}`, { session: ops });
    expect(detail.json().customer).toMatchObject({ email: "alice@example.com" });
    expect(detail.json().product).toEqual({
      type: "HOTEL",
      slug: "ridge-cottages",
      departureId: null,
    });

    // Bookings filtered by hotel and by customer.
    const byHotel = await h.call("GET", "/admin/bookings?hotel=ridge-cottages", { session: ops });
    expect(byHotel.json().items.map((b: { id: string }) => b.id)).toEqual([id]);
    const byCustomer = await h.call(
      "GET",
      `/admin/bookings?customerId=${detail.json().customer.id}`,
      { session: ops },
    );
    expect(byCustomer.json().items).toHaveLength(1);

    // Hotel shows its active booking; customer views show the booking.
    const hotel = await h.call("GET", "/admin/hotels/ridge-cottages", { session: ops });
    expect(hotel.json()).toMatchObject({ activeBookings: 1, roomCount: 1 });
    const customers = await h.call("GET", "/admin/customers?q=alice", { session: support });
    expect(customers.json().items[0]).toMatchObject({
      email: "alice@example.com",
      bookingCount: 1,
    });
    const customer = await h.call("GET", `/admin/customers/${customers.json().items[0].id}`, {
      session: support,
    });
    expect(customer.json().bookings[0].id).toBe(id);
    expect(customer.json().lifetimeValue.amountMinor).toBe(0); // nothing confirmed yet
  });

  it("manages tours and departures with seat safety", async () => {
    const tour = await h.call("POST", "/admin/tours", {
      session: content,
      body: {
        slug: "sajek-sunrise-trip",
        destinationSlug: "sajek",
        title: "Sajek Sunrise Trip",
        summary: "Two days on the ridge with a sunrise walk.",
        description: "Day 1: drive from Khagrachari. Day 2: Konglak sunrise.",
        durationDays: 2,
        durationNights: 1,
        meetingPoint: "Khagrachari bus stand",
        groupSizeMax: 12,
        highlights: ["Konglak sunrise"],
        includes: ["Jeep", "Cottage"],
        excludes: ["Personal expenses"],
        vatBps: 500,
        status: "PUBLISHED",
      },
    });
    expect(tour.statusCode).toBe(201);
    const departsAt = new Date(Date.now() + 9 * 86_400_000).toISOString();
    const returnsAt = new Date(Date.now() + 10 * 86_400_000).toISOString();
    const dep = await h.call("POST", "/admin/tours/sajek-sunrise-trip/departures", {
      session: ops,
      body: {
        departsAt,
        returnsAt,
        capacity: 6,
        priceAdult: { amountMinor: 900_000, currency: "BDT" },
        priceChild: { amountMinor: 500_000, currency: "BDT" },
      },
    });
    expect(dep.statusCode).toBe(201);
    const departureId = dep.json().departure.id;

    const pub = await h.call("GET", "/tours/sajek-sunrise-trip");
    expect(pub.json().departures[0]).toMatchObject({ id: departureId, seatsLeft: 6 });

    const bob = await h.register("bob@example.com");
    const quote = await h.call("GET", `/quotes/tour?departureId=${departureId}&adults=2`);
    const b = await h.call("POST", "/bookings", {
      session: bob,
      headers: { "idempotency-key": randomUUID() },
      body: {
        product: "TOUR",
        departureId,
        adults: 2,
        children: 0,
        contact: { name: "Bob Karim", email: "bob@example.com", phone: "+8801811000000" },
        guests: [
          { fullName: "Bob Karim", ageGroup: "ADULT" },
          { fullName: "Rina Karim", ageGroup: "ADULT" },
        ],
        expectedTotal: quote.json().price.total,
      },
    });
    expect(b.statusCode).toBe(201);
    const bookingDetail = await h.call("GET", `/admin/bookings/${b.json().id}`, { session: ops });
    expect(bookingDetail.json().product).toEqual({
      type: "TOUR",
      slug: "sajek-sunrise-trip",
      departureId,
    });

    const shrink = await h.call("PATCH", `/admin/departures/${departureId}`, {
      session: ops,
      body: { capacity: 1 },
    });
    expect(shrink.statusCode).toBe(409);
    const cancel = await h.call("PATCH", `/admin/departures/${departureId}`, {
      session: ops,
      body: { status: "CANCELLED" },
    });
    expect(cancel.json().type).toBe("/problems/departure-has-bookings");
    const close = await h.call("PATCH", `/admin/departures/${departureId}`, {
      session: ops,
      body: { status: "CLOSED", priceAdult: { amountMinor: 950_000, currency: "BDT" } },
    });
    expect(close.json().departure).toMatchObject({ status: "CLOSED", held: 2 });
    // Existing booking keeps its price snapshot.
    expect(bookingDetail.json().total).toEqual(quote.json().price.total);

    const list = await h.call("GET", "/admin/tours", { session: ops });
    expect(
      list.json().items.find((t: { slug: string }) => t.slug === "sajek-sunrise-trip"),
    ).toMatchObject({ activeBookings: 1 });
  });

  it("audits every catalog and inventory change with the staff member", async () => {
    const audit = await h.call("GET", "/admin/audit?action=catalog.", { session: owner });
    const actions = audit.json().items.map((a: { action: string }) => a.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        "catalog.destination.created",
        "catalog.hotel.created",
        "catalog.room.created",
        "catalog.tour.created",
      ]),
    );
    const inv = await h.call("GET", "/admin/audit?action=inventory.", { session: owner });
    expect(inv.json().items.map((a: { action: string }) => a.action)).toEqual(
      expect.arrayContaining([
        "inventory.calendar.updated",
        "inventory.departure.created",
        "inventory.departure.updated",
      ]),
    );
    expect(inv.json().items[0].actorName).toBe("operations person");
  });

  it("rejects edits to the past and unknown destinations", async () => {
    const past = await h.call("PUT", `/admin/rooms/${roomId}/calendar`, {
      session: ops,
      body: { from: day(-2), to: day(1), total: 4 },
    });
    expect(past.statusCode).toBe(422);
    const unknown = await h.call("PUT", "/admin/hotels/ridge-cottages", {
      session: content,
      body: {
        destinationSlug: "nowhere",
        name: "Ridge Cottages",
        starRating: 3,
        addressLine: "Ruilui Para, Sajek",
        summary: "Wooden cottages on the ridge facing the sunrise.",
        checkInTime: "13:00",
        checkOutTime: "11:00",
        cancellationPolicy: "Free cancellation up to 3 days before arrival.",
        serviceChargeBps: 0,
        vatBps: 1500,
        status: "PUBLISHED",
      },
    });
    expect(unknown.json().type).toBe("/problems/unknown-destination");
  });
});
