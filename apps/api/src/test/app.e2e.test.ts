import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app.factory";
import { PasswordService } from "../auth/password.service";
import { loadConfig } from "../config/config";
import { PRISMA } from "../prisma/prisma.service";
import { addBooking, createFakeDb, type FakeDb } from "./fake-db";

const ORIGIN = "http://localhost:3001";
const config = loadConfig({
  NODE_ENV: "test",
  LOG_LEVEL: "silent",
  DATABASE_URL: "mysql://test@127.0.0.1:3306/unused",
  SESSION_SECRET: randomBytes(32).toString("base64url"),
  APP_ORIGINS: "http://localhost:3000,http://localhost:3001",
  OPENAPI_ENABLED: "true",
  HOLD_SWEEP_SECONDS: "0",
});

let app: NestFastifyApplication;
let db: FakeDb;

function cookieFrom(res: { headers: Record<string, unknown> }, name: string): string {
  const raw = res.headers["set-cookie"];
  const list = Array.isArray(raw) ? raw : [raw];
  const hit = list.find((c) => typeof c === "string" && c.startsWith(`${name}=`)) as string;
  expect(hit, `cookie ${name}`).toBeDefined();
  return hit.split(";")[0]!;
}

beforeAll(async () => {
  db = createFakeDb();
  app = await createApp({ config, prisma: { provide: PRISMA, useValue: db.client }, quiet: true });
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  // A staff user with the operations role, created the way create-staff does.
  const hash = await app.get(PasswordService).hash("staff-password-123");
  const staff = (await (
    db.client as { user: { create: (a: unknown) => Promise<{ id: bigint }> } }
  ).user.create({
    data: {
      publicId: "01JBX00000000000000000STAF",
      email: "ops@pegah.test",
      passwordHash: hash,
      fullName: "Ops Person",
      kind: "STAFF",
    },
  })) as { id: bigint };
  db.grants.push({
    userId: staff.id,
    roleKey: "operations",
    permissions: ["booking:read", "booking:override_status", "dashboard:read"],
  });
});

afterAll(async () => {
  await app?.close();
});

describe("platform", () => {
  it("serves liveness and readiness", async () => {
    const live = await app.inject({ method: "GET", url: "/api/v1/health/live" });
    expect(live.statusCode).toBe(200);
    expect(live.json()).toMatchObject({ status: "ok" });
    const ready = await app.inject({ method: "GET", url: "/api/v1/health/ready" });
    expect(ready.statusCode).toBe(200);
    expect(ready.json()).toMatchObject({ status: "ok", checks: { database: "up" } });
  });

  it("sets security headers", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/health/live" });
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(String(res.headers["content-security-policy"])).toContain("default-src 'none'");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("returns RFC 9457 problems for unknown routes", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/nope" });
    expect(res.statusCode).toBe(404);
    expect(res.headers["content-type"]).toContain("application/problem+json");
    expect(res.json()).toMatchObject({ status: 404, title: "Not found" });
  });

  it("publishes an OpenAPI document generated from the contracts", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/docs/openapi.json" });
    expect(res.statusCode).toBe(200);
    const doc = res.json();
    expect(doc.paths).toHaveProperty("/api/v1/auth/login");
    expect(doc.paths).toHaveProperty("/api/v1/hotels/search");
    expect(doc.components.schemas).toHaveProperty("SessionUser_Output");
    expect(doc.components.schemas).toHaveProperty("Money_Output");
  });
});

describe("customer auth", () => {
  let cookie = "";
  let csrf = "";

  it("validates input with field-level problems", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      headers: { origin: ORIGIN },
      payload: { email: "not-an-email", password: "short", fullName: "A" },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.type).toBe("/problems/validation");
    expect(body.errors.map((e: { path: string }) => e.path).sort()).toEqual(
      ["email", "fullName", "password"].sort(),
    );
  });

  it("registers, normalises the email and sets an HttpOnly session cookie", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      headers: { origin: ORIGIN },
      payload: {
        email: "  Rahim@Example.COM ",
        password: "correct-horse-battery",
        fullName: "Rahim Uddin",
        phone: "+8801712345678",
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.user).toMatchObject({
      email: "rahim@example.com",
      kind: "CUSTOMER",
      permissions: [],
    });
    expect(body.user).not.toHaveProperty("passwordHash");
    const setCookie = String(res.headers["set-cookie"]);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    cookie = cookieFrom(res, "pg_sid");
    csrf = body.csrfToken;
    // Only the hash of the token is stored.
    const token = cookie.split("=")[1]!;
    expect(db.sessions.some((s) => s.tokenHash === token)).toBe(false);
    // Passwords are stored as Argon2id hashes.
    expect(String(db.users.find((u) => u.email === "rahim@example.com")?.passwordHash)).toMatch(
      /^\$argon2id\$/,
    );
  });

  it("rejects a duplicate email with 409", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      headers: { origin: ORIGIN },
      payload: { email: "rahim@example.com", password: "another-password-1", fullName: "Someone" },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().type).toBe("/problems/email-taken");
  });

  it("returns the current session", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/auth/session",
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.fullName).toBe("Rahim Uddin");
    expect(res.json().csrfToken).toBe(csrf);
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("requires a session for protected routes", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/auth/session" });
    expect(res.statusCode).toBe(401);
    expect(res.json().type).toBe("/problems/unauthenticated");
  });

  it("rejects mutations without the CSRF token", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: { cookie, origin: ORIGIN },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().type).toBe("/problems/csrf-invalid");
  });

  it("rejects mutations from origins outside the allow-list", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: { cookie, origin: "https://evil.example", "x-csrf-token": csrf },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().type).toBe("/problems/origin-not-allowed");
  });

  it("does not let a customer session reach staff routes", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/bookings",
      headers: { cookie },
    });
    expect(res.statusCode).toBe(401);
  });

  it("logs out and revokes the session server-side", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: { cookie, origin: ORIGIN, "x-csrf-token": csrf },
    });
    expect(res.statusCode).toBe(204);
    const after = await app.inject({
      method: "GET",
      url: "/api/v1/auth/session",
      headers: { cookie },
    });
    expect(after.statusCode).toBe(401);
  });

  it("gives the same answer for a wrong password and an unknown email", async () => {
    const wrong = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      headers: { origin: ORIGIN },
      payload: { email: "rahim@example.com", password: "wrong-password!" },
    });
    const unknown = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      headers: { origin: ORIGIN },
      payload: { email: "nobody@example.com", password: "wrong-password!" },
    });
    expect(wrong.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    expect(wrong.json().type).toBe(unknown.json().type);
    expect(wrong.json().detail).toBe(unknown.json().detail);
  });

  it("lists only the customer's own bookings", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      headers: { origin: ORIGIN },
      payload: { email: "rahim@example.com", password: "correct-horse-battery" },
    });
    expect(login.statusCode).toBe(200);
    const c = cookieFrom(login, "pg_sid");
    const me = db.users.find((u) => u.email === "rahim@example.com")!;
    addBooking(db, {
      publicId: "01JBX0000000000000000000M1",
      reference: "PG-MINE01",
      userId: me.id,
    });
    addBooking(db, {
      publicId: "01JBX0000000000000000000T1",
      reference: "PG-THEIR1",
      userId: 999n,
    });

    const list = await app.inject({
      method: "GET",
      url: "/api/v1/me/bookings",
      headers: { cookie: c },
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().items.map((b: { reference: string }) => b.reference)).toEqual(["PG-MINE01"]);

    const theirs = await app.inject({
      method: "GET",
      url: "/api/v1/me/bookings/01JBX0000000000000000000T1",
      headers: { cookie: c },
    });
    expect(theirs.statusCode).toBe(404);
  });
});

describe("staff auth and RBAC", () => {
  let cookie = "";
  let csrf = "";

  it("rejects customers on the staff login", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/staff/auth/login",
      headers: { origin: ORIGIN },
      payload: { email: "rahim@example.com", password: "correct-horse-battery" },
    });
    expect(res.statusCode).toBe(401);
    expect(db.audits.some((a) => a.action === "auth.staff_login.failed")).toBe(true);
  });

  it("signs staff in with their role's permissions and audits it", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/staff/auth/login",
      headers: { origin: ORIGIN },
      payload: { email: "OPS@pegah.test", password: "staff-password-123" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().user).toMatchObject({ kind: "STAFF", roles: ["operations"] });
    expect(res.json().user.permissions).toContain("booking:override_status");
    cookie = cookieFrom(res, "pg_staff_sid");
    csrf = res.json().csrfToken;
    expect(db.audits.some((a) => a.action === "auth.staff_login.succeeded")).toBe(true);
  });

  it("lists bookings for staff with booking:read", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/bookings?limit=1",
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().items).toHaveLength(1);
    expect(res.json().nextCursor).toEqual(expect.any(String));
  });

  it("moves a booking through the state machine with history and audit", async () => {
    addBooking(db, {
      publicId: "01JBX0000000000000000000R1",
      reference: "PG-REVIEW",
      status: "MANUAL_REVIEW",
      userId: 1n,
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/admin/bookings/01JBX0000000000000000000R1/status",
      headers: { cookie, origin: ORIGIN, "x-csrf-token": csrf },
      payload: {
        to: "CONFIRMED",
        expectedStatus: "MANUAL_REVIEW",
        reason: "Supplier confirmed by phone",
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe("CONFIRMED");
    expect(body.history).toHaveLength(1);
    expect(body.history[0]).toMatchObject({
      from: "MANUAL_REVIEW",
      to: "CONFIRMED",
      actorType: "STAFF",
    });
    expect(body.allowedTransitions).toContain("CANCELLATION_REQUESTED");
    expect(db.audits.some((a) => a.action === "booking.status_changed")).toBe(true);
  });

  it("rejects illegal transitions and stale expected status", async () => {
    const illegal = await app.inject({
      method: "POST",
      url: "/api/v1/admin/bookings/01JBX0000000000000000000R1/status",
      headers: { cookie, origin: ORIGIN, "x-csrf-token": csrf },
      payload: { to: "REFUNDED", expectedStatus: "CONFIRMED", reason: "Trying to skip steps" },
    });
    expect(illegal.statusCode).toBe(422);
    expect(illegal.json().type).toBe("/problems/illegal-transition");

    const stale = await app.inject({
      method: "POST",
      url: "/api/v1/admin/bookings/01JBX0000000000000000000R1/status",
      headers: { cookie, origin: ORIGIN, "x-csrf-token": csrf },
      payload: { to: "CONFIRMED", expectedStatus: "MANUAL_REVIEW", reason: "Double click again" },
    });
    expect(stale.statusCode).toBe(409);
  });

  it("forbids staff without the needed permission", async () => {
    const hash = await app.get(PasswordService).hash("support-password-1");
    const support = (await (
      db.client as { user: { create: (a: unknown) => Promise<{ id: bigint }> } }
    ).user.create({
      data: {
        publicId: "01JBX00000000000000000S2PP",
        email: "support@pegah.test",
        passwordHash: hash,
        fullName: "Support Person",
        kind: "STAFF",
      },
    })) as { id: bigint };
    db.grants.push({ userId: support.id, roleKey: "support", permissions: ["booking:read"] });

    const login = await app.inject({
      method: "POST",
      url: "/api/v1/staff/auth/login",
      headers: { origin: ORIGIN },
      payload: { email: "support@pegah.test", password: "support-password-1" },
    });
    expect(login.statusCode, login.body).toBe(200);
    const c = cookieFrom(login, "pg_staff_sid");
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/admin/bookings/01JBX0000000000000000000R1/status",
      headers: { cookie: c, origin: ORIGIN, "x-csrf-token": login.json().csrfToken },
      payload: {
        to: "CANCELLATION_REQUESTED",
        expectedStatus: "CONFIRMED",
        reason: "Customer asked",
      },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().type).toBe("/problems/forbidden");
  });
});
