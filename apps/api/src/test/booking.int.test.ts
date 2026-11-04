/* Integration tests against a real MySQL 8.4 server.
 *
 * Skipped unless PEGAH_IT_DATABASE_URL points at a MySQL user that may create
 * and drop databases named pegah_it_* (CI starts a throwaway server; locally
 * use a portable server bound to 127.0.0.1). Each run creates a fresh
 * database, applies the real migrations, and drops it afterwards. */
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { createPrismaClient, type PrismaClient } from "@pegah/db";
import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app.factory";
import { PasswordService } from "../auth/password.service";
import { HoldExpiryService } from "../booking/hold-expiry.service";
import { newPublicId } from "../common/ids";
import { addDays, dhakaToday, formatCalendarDate } from "../common/time";
import { loadConfig } from "../config/config";
import { PRISMA } from "../prisma/prisma.service";
import { ROLE_DEFAULTS } from "../rbac/role-defaults";

const ADMIN_URL = process.env.PEGAH_IT_DATABASE_URL;
const ORIGIN = "http://localhost:3000";
const taka = (t: number) => BigInt(t) * 100n;

interface Session {
  cookie: string;
  csrf: string;
}

describe.skipIf(!ADMIN_URL)("booking engine against MySQL 8.4", () => {
  const dbName = `pegah_it_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
  let admin: PrismaClient;
  let db: PrismaClient;
  let app: NestFastifyApplication;
  let alice: Session;
  let bob: Session;
  let owner: Session;
  const ids = {} as {
    deluxeRoom: string;
    lastRoom: string;
    lastRoomDbId: bigint;
    deluxeDbId: bigint;
    departure: string;
    departureDbId: bigint;
  };
  const today = dhakaToday();
  const checkIn = formatCalendarDate(addDays(today, 10));
  const checkOut = formatCalendarDate(addDays(today, 12));

  function urlFor(name: string): string {
    const u = new URL(ADMIN_URL!);
    u.pathname = `/${name}`;
    return u.toString();
  }

  async function call(
    method: "GET" | "POST" | "PATCH",
    url: string,
    opts: { session?: Session; body?: unknown; headers?: Record<string, string> } = {},
  ) {
    return app.inject({
      method,
      url: `/api/v1${url}`,
      headers: {
        origin: ORIGIN,
        ...(opts.session ? { cookie: opts.session.cookie, "x-csrf-token": opts.session.csrf } : {}),
        ...opts.headers,
      },
      ...(opts.body !== undefined ? { payload: opts.body as object } : {}),
    });
  }

  function sessionFrom(res: Awaited<ReturnType<typeof call>>, name: string): Session {
    const raw = res.headers["set-cookie"];
    const list = (Array.isArray(raw) ? raw : [raw]) as string[];
    const cookie = list.find((c) => c.startsWith(`${name}=`))!.split(";")[0]!;
    return { cookie, csrf: res.json().csrfToken as string };
  }

  async function register(email: string): Promise<Session> {
    const res = await call("POST", "/auth/register", {
      body: { email, password: "correct-horse-battery", fullName: "Test Traveller" },
    });
    expect(res.statusCode).toBe(201);
    return sessionFrom(res, "pg_sid");
  }

  const contact = { name: "Nusrat Jahan", email: "nusrat@example.com", phone: "+8801711000000" };

  async function hotelQuoteTotal(roomId: string, rooms = 1) {
    const res = await call(
      "GET",
      `/quotes/hotel?roomId=${roomId}&checkIn=${checkIn}&checkOut=${checkOut}&adults=2&rooms=${rooms}`,
    );
    expect(res.statusCode).toBe(200);
    return res.json().price.total as { amountMinor: number; currency: string };
  }

  function hotelBody(roomId: string, expectedTotal: unknown) {
    return {
      product: "HOTEL",
      roomId,
      checkIn,
      checkOut,
      rooms: 1,
      adults: 2,
      children: 0,
      contact,
      guests: [
        { fullName: "Nusrat Jahan", ageGroup: "ADULT" },
        { fullName: "Tanvir Ahmed", ageGroup: "ADULT" },
      ],
      expectedTotal,
    };
  }

  beforeAll(async () => {
    admin = createPrismaClient({ url: urlFor(""), connectionLimit: 1 });
    await admin.$executeRawUnsafe(
      `CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`,
    );
    const dbUrl = urlFor(dbName);
    const dbPackage = resolve(__dirname, "../../../../packages/db");
    const prismaCli = createRequire(resolve(dbPackage, "package.json")).resolve(
      "prisma/build/index.js",
    );
    execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], {
      cwd: dbPackage,
      env: { ...process.env, DATABASE_URL: dbUrl },
      stdio: "pipe",
    });

    const config = loadConfig({
      NODE_ENV: "test",
      LOG_LEVEL: "silent",
      DATABASE_URL: dbUrl,
      SESSION_SECRET: randomBytes(32).toString("base64url"),
      APP_ORIGINS: ORIGIN,
      HOLD_SWEEP_SECONDS: "0",
      BOOKING_HOLD_MINUTES: "15",
    });
    app = await createApp({ config, quiet: true });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    db = app.get<PrismaClient>(PRISMA);

    // ── Fixture catalog ──
    const dest = await db.destination.create({
      data: {
        slug: "it-sreemangal",
        name: "Sreemangal",
        region: "Sylhet",
        summary: "Test destination",
        status: "PUBLISHED",
      },
    });
    const hotel = await db.hotel.create({
      data: {
        publicId: newPublicId(),
        slug: "it-tea-resort",
        name: "IT Tea Resort",
        destinationId: dest.id,
        addressLine: "Test",
        summary: "Test",
        cancellationPolicy: "Test policy",
        serviceChargeBps: 1000,
        vatBps: 1500,
        status: "PUBLISHED",
      },
    });
    const nights = Array.from({ length: 30 }, (_, i) => addDays(today, i));
    for (const [name, total, rate] of [
      ["Deluxe", 5, 8500],
      ["Last Room", 1, 6000],
    ] as const) {
      const room = await db.hotelRoom.create({
        data: {
          publicId: newPublicId(),
          hotelId: hotel.id,
          name,
          description: name,
          maxAdults: 2,
          maxChildren: 1,
          bedType: "King",
        },
      });
      await db.roomInventory.createMany({
        data: nights.map((stayDate) => ({ roomId: room.id, stayDate, total })),
      });
      await db.roomRate.createMany({
        data: nights.map((stayDate) => ({ roomId: room.id, stayDate, amountMinor: taka(rate) })),
      });
      if (name === "Deluxe") {
        ids.deluxeRoom = room.publicId;
        ids.deluxeDbId = room.id;
      } else {
        ids.lastRoom = room.publicId;
        ids.lastRoomDbId = room.id;
      }
    }
    const tour = await db.tour.create({
      data: {
        publicId: newPublicId(),
        slug: "it-river-cruise",
        destinationId: dest.id,
        title: "IT River Cruise",
        summary: "Test",
        description: "Test",
        durationDays: 2,
        durationNights: 1,
        meetingPoint: "Ghat",
        groupSizeMax: 3,
        highlights: [],
        includes: [],
        excludes: [],
        vatBps: 500,
        status: "PUBLISHED",
      },
    });
    const departsAt = new Date(addDays(today, 7).getTime() + 3_600_000);
    const schedule = await db.tourSchedule.create({
      data: {
        publicId: newPublicId(),
        tourId: tour.id,
        departsAt,
        returnsAt: new Date(departsAt.getTime() + 86_400_000),
        capacity: 3,
        priceAdultMinor: taka(10000),
        priceChildMinor: taka(6000),
      },
    });
    ids.departure = schedule.publicId;
    ids.departureDbId = schedule.id;

    // ── RBAC and an owner, as seed:rbac and staff:create would do ──
    for (const [key, def] of Object.entries(ROLE_DEFAULTS)) {
      await db.role.create({
        data: {
          key,
          name: def.name,
          description: def.description,
          isSystem: true,
          permissions: {
            create: def.permissions.map((p) => ({
              permission: {
                connectOrCreate: { where: { key: p }, create: { key: p, description: p } },
              },
            })),
          },
        },
      });
    }
    const ownerRole = await db.role.findUniqueOrThrow({ where: { key: "owner" } });
    await db.user.create({
      data: {
        publicId: newPublicId(),
        email: "owner@pegah.test",
        fullName: "Owner Person",
        passwordHash: await app.get(PasswordService).hash("owner-password-123"),
        kind: "STAFF",
        roles: { create: [{ roleId: ownerRole.id }] },
      },
    });
    const login = await call("POST", "/staff/auth/login", {
      body: { email: "owner@pegah.test", password: "owner-password-123" },
    });
    expect(login.statusCode).toBe(200);
    owner = sessionFrom(login, "pg_staff_sid");

    alice = await register("alice@example.com");
    bob = await register("bob@example.com");
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await admin?.$executeRawUnsafe(`DROP DATABASE IF EXISTS \`${dbName}\``);
    await admin?.$disconnect();
  });

  it("prices a stay server-side and creates a held booking", async () => {
    const total = await hotelQuoteTotal(ids.deluxeRoom);
    // Weekday/weekend-agnostic fixture: 2 nights × ৳8,500 + 10% SC + 15% VAT.
    expect(total).toEqual({ amountMinor: 2_150_500_00 / 100, currency: "BDT" });

    const res = await call("POST", "/bookings", {
      session: alice,
      headers: { "idempotency-key": randomUUID() },
      body: hotelBody(ids.deluxeRoom, total),
    });
    expect(res.statusCode).toBe(201);
    const booking = res.json();
    expect(booking).toMatchObject({
      status: "PENDING_PAYMENT",
      productType: "HOTEL",
      productName: "IT Tea Resort",
      startDate: checkIn,
      endDate: checkOut,
      guests: 2,
      total,
      price: { base: { amountMinor: 1_700_000 }, serviceCharge: { amountMinor: 170_000 } },
    });
    expect(booking.reference).toMatch(/^PG-[2-9A-HJKMNP-Z]{6}$/);
    expect(new Date(booking.holdExpiresAt).getTime()).toBeGreaterThan(Date.now() + 14 * 60_000);
    expect(booking.history.map((h: { to: string }) => h.to)).toEqual([
      "PENDING_AVAILABILITY",
      "PENDING_PAYMENT",
    ]);
    expect(booking.allowedTransitions).toContain("CANCELLED");
    expect(booking.allowedTransitions).not.toContain("CONFIRMED");

    const inv = await db.roomInventory.findMany({
      where: { roomId: ids.deluxeDbId, held: { gt: 0 } },
    });
    expect(inv.map((i) => i.held)).toEqual([1, 1]);
    const holds = await db.inventoryHold.count({ where: { status: "ACTIVE" } });
    expect(holds).toBe(2);
  });

  it("replays a retried request instead of booking twice", async () => {
    const key = randomUUID();
    const body = hotelBody(ids.deluxeRoom, await hotelQuoteTotal(ids.deluxeRoom));
    const first = await call("POST", "/bookings", {
      session: alice,
      headers: { "idempotency-key": key },
      body,
    });
    const retry = await call("POST", "/bookings", {
      session: alice,
      headers: { "idempotency-key": key },
      body,
    });
    expect(first.statusCode).toBe(201);
    expect(retry.statusCode).toBe(201);
    expect(retry.headers["idempotent-replayed"]).toBe("true");
    expect(retry.json().id).toBe(first.json().id);
    expect(await db.booking.count({ where: { publicId: first.json().id } })).toBe(1);

    const reused = await call("POST", "/bookings", {
      session: alice,
      headers: { "idempotency-key": key },
      body: { ...body, adults: 1, guests: body.guests.slice(0, 1) },
    });
    expect(reused.statusCode).toBe(422);
    expect(reused.json().type).toBe("/problems/idempotency-key-reused");

    const missing = await call("POST", "/bookings", { session: alice, body });
    expect(missing.statusCode).toBe(400);
    expect(missing.json().type).toBe("/problems/idempotency-key-required");
  });

  it("lets exactly one of two simultaneous customers take the last room", async () => {
    const total = await hotelQuoteTotal(ids.lastRoom);
    const [a, b] = await Promise.all([
      call("POST", "/bookings", {
        session: alice,
        headers: { "idempotency-key": randomUUID() },
        body: hotelBody(ids.lastRoom, total),
      }),
      call("POST", "/bookings", {
        session: bob,
        headers: { "idempotency-key": randomUUID() },
        body: hotelBody(ids.lastRoom, total),
      }),
    ]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([201, 409]);
    const loser = a.statusCode === 409 ? a : b;
    expect(loser.json().type).toBe("/problems/not-available");
    const inv = await db.roomInventory.findMany({
      where: { roomId: ids.lastRoomDbId, held: { gt: 0 } },
    });
    expect(inv.every((i) => i.held === 1 && i.held + i.sold <= i.total)).toBe(true);
  });

  it("rejects a booking when the price changed since the quote", async () => {
    const before = await db.roomInventory.aggregate({
      where: { roomId: ids.deluxeDbId },
      _sum: { held: true },
    });
    const res = await call("POST", "/bookings", {
      session: bob,
      headers: { "idempotency-key": randomUUID() },
      body: hotelBody(ids.deluxeRoom, { amountMinor: 100, currency: "BDT" }),
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().type).toBe("/problems/price-changed");
    const after = await db.roomInventory.aggregate({
      where: { roomId: ids.deluxeDbId },
      _sum: { held: true },
    });
    expect(after._sum.held).toBe(before._sum.held);
  });

  it("validates the party server-side", async () => {
    const body = hotelBody(ids.deluxeRoom, await hotelQuoteTotal(ids.deluxeRoom));
    const res = await call("POST", "/bookings", {
      session: bob,
      headers: { "idempotency-key": randomUUID() },
      body: { ...body, guests: body.guests.slice(0, 1) },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().errors[0].path).toBe("guests");
  });

  it("releases inventory when the customer cancels an unpaid booking", async () => {
    const created = await call("POST", "/bookings", {
      session: bob,
      headers: { "idempotency-key": randomUUID() },
      body: hotelBody(ids.deluxeRoom, await hotelQuoteTotal(ids.deluxeRoom)),
    });
    const id = created.json().id as string;
    const heldBefore = await db.roomInventory.aggregate({
      where: { roomId: ids.deluxeDbId },
      _sum: { held: true },
    });

    // Another customer cannot see or cancel it.
    expect((await call("GET", `/me/bookings/${id}`, { session: alice })).statusCode).toBe(404);
    expect(
      (await call("POST", `/me/bookings/${id}/cancel`, { session: alice, body: {} })).statusCode,
    ).toBe(404);

    const res = await call("POST", `/me/bookings/${id}/cancel`, { session: bob, body: {} });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: "CANCELLED", holdExpiresAt: null });
    const heldAfter = await db.roomInventory.aggregate({
      where: { roomId: ids.deluxeDbId },
      _sum: { held: true },
    });
    expect(heldAfter._sum.held).toBe((heldBefore._sum.held ?? 0) - 2);
    const holds = await db.inventoryHold.findMany({ where: { booking: { publicId: id } } });
    expect(holds.every((h) => h.status === "RELEASED" && h.releasedAt)).toBe(true);
  });

  it("holds tour seats and expires unpaid bookings, putting seats back on sale", async () => {
    const quote = await call(
      "GET",
      `/quotes/tour?departureId=${ids.departure}&adults=2&children=1`,
    );
    expect(quote.json()).toMatchObject({
      available: true,
      left: 3,
      // 2 × ৳10,000 + ৳6,000 + 5% VAT = ৳27,300
      price: { total: { amountMinor: 2_730_000, currency: "BDT" } },
    });
    const res = await call("POST", "/bookings", {
      session: alice,
      headers: { "idempotency-key": randomUUID() },
      body: {
        product: "TOUR",
        departureId: ids.departure,
        adults: 2,
        children: 1,
        contact,
        guests: [
          { fullName: "Nusrat Jahan", ageGroup: "ADULT" },
          { fullName: "Tanvir Ahmed", ageGroup: "ADULT" },
          { fullName: "Ayaan Ahmed", ageGroup: "CHILD" },
        ],
        expectedTotal: quote.json().price.total,
      },
    });
    expect(res.statusCode).toBe(201);
    let schedule = await db.tourSchedule.findUniqueOrThrow({ where: { id: ids.departureDbId } });
    expect(schedule.held).toBe(3);

    const full = await call("GET", `/quotes/tour?departureId=${ids.departure}&adults=1`);
    expect(full.json()).toMatchObject({ available: false, unavailableReason: "sold-out" });

    const expired = await app.get(HoldExpiryService).sweep(new Date(Date.now() + 16 * 60_000));
    expect(expired).toBeGreaterThanOrEqual(1);
    schedule = await db.tourSchedule.findUniqueOrThrow({ where: { id: ids.departureDbId } });
    expect(schedule.held).toBe(0);
    const detail = await call("GET", `/me/bookings/${res.json().id}`, { session: alice });
    expect(detail.json().status).toBe("EXPIRED");
    expect(detail.json().history.at(-1)).toMatchObject({ actorType: "SYSTEM", to: "EXPIRED" });
    // No hotel hold is left behind either: every hold of an expired booking is released.
    const activeOfExpired = await db.inventoryHold.count({
      where: { status: "ACTIVE", booking: { status: "EXPIRED" } },
    });
    expect(activeOfExpired).toBe(0);
  });

  it("enforces held + sold <= total in the database itself", async () => {
    await expect(
      db.roomInventory.updateMany({
        where: { roomId: ids.lastRoomDbId },
        data: { held: { increment: 5 } },
      }),
    ).rejects.toThrow(/3819|check constraint/i);
  });

  it("serves the staff dashboard, staff management and audit log from MySQL", async () => {
    const dash = await call("GET", "/admin/dashboard", { session: owner });
    expect(dash.statusCode).toBe(200);
    const d = dash.json();
    // The sweep above (run 16 minutes ahead) expired every unpaid booking.
    expect(d.kpis.pendingPayment).toBe(0);
    expect(d.kpis.bookings30d).toBeGreaterThanOrEqual(5);
    const byStatus = Object.fromEntries(
      d.statusCounts.map((s: { status: string; count: number }) => [s.status, s.count]),
    );
    expect(byStatus.CANCELLED).toBe(1);
    expect(byStatus.EXPIRED).toBeGreaterThanOrEqual(4);
    // Confirmed revenue stays zero: nothing is confirmed without payment.
    expect(d.kpis.confirmedValue30d.amountMinor).toBe(0);
    expect(d.daily).toHaveLength(30);
    expect(d.occupancy.hotels[0].values).toHaveLength(14);
    expect(d.recentBookings.length).toBeGreaterThan(0);
    expect(d.departures[0]).toMatchObject({ tourTitle: "IT River Cruise", capacity: 3 });

    const created = await call("POST", "/admin/staff", {
      session: owner,
      body: {
        email: "ops@pegah.test",
        fullName: "Ops Person",
        password: "ops-password-123",
        roles: ["operations"],
      },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ roles: ["operations"], status: "ACTIVE" });

    // The last owner cannot be demoted, not even by themselves.
    const list = await call("GET", "/admin/staff", { session: owner });
    const me = list.json().items.find((s: { email: string }) => s.email === "owner@pegah.test");
    const demote = await call("PATCH", `/admin/staff/${me.id}`, {
      session: owner,
      body: { roles: ["admin"] },
    });
    expect(demote.statusCode).toBe(422);

    // An operations user has no user:manage or audit:read.
    const opsLogin = await call("POST", "/staff/auth/login", {
      body: { email: "ops@pegah.test", password: "ops-password-123" },
    });
    const ops = sessionFrom(opsLogin, "pg_staff_sid");
    expect((await call("GET", "/admin/staff", { session: ops })).statusCode).toBe(403);
    expect((await call("GET", "/admin/audit", { session: ops })).statusCode).toBe(403);

    // Disabling revokes the session at once.
    const disable = await call("PATCH", `/admin/staff/${created.json().id}`, {
      session: owner,
      body: { status: "DISABLED" },
    });
    expect(disable.statusCode).toBe(200);
    expect((await call("GET", "/staff/auth/session", { session: ops })).statusCode).toBe(401);

    const audit = await call("GET", "/admin/audit?action=staff.", { session: owner });
    expect(audit.statusCode).toBe(200);
    expect(audit.json().items.map((a: { action: string }) => a.action)).toEqual([
      "staff.updated",
      "staff.created",
    ]);
    expect(audit.json().items[0].actorName).toBe("Owner Person");
  });
});
