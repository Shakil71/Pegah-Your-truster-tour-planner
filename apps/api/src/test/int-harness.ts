/* Shared setup for MySQL integration suites: fresh database, real migrations,
 * the real app, and a small fixture catalog. See booking.int.test.ts. */
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { createPrismaClient, type PrismaClient } from "@pegah/db";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { expect } from "vitest";
import { createApp } from "../app.factory";
import { newPublicId } from "../common/ids";
import { addDays, dhakaToday } from "../common/time";
import { loadConfig } from "../config/config";
import { PasswordService } from "../auth/password.service";
import { PRISMA } from "../prisma/prisma.service";
import { ROLE_DEFAULTS } from "../rbac/role-defaults";

export const ADMIN_URL = process.env.PEGAH_IT_DATABASE_URL;
export const ORIGIN = "http://localhost:3000";
const taka = (t: number) => BigInt(t) * 100n;

export interface Session {
  cookie: string;
  csrf: string;
}

export interface Harness {
  app: NestFastifyApplication;
  db: PrismaClient;
  roomId: string;
  departureId: string;
  call: (
    method: "GET" | "POST" | "PATCH" | "PUT",
    url: string,
    opts?: {
      session?: Session;
      body?: unknown;
      headers?: Record<string, string>;
      form?: Record<string, string>;
    },
  ) => ReturnType<NestFastifyApplication["inject"]>;
  register: (email: string) => Promise<Session>;
  /** Creates a staff user with one system role and signs them in. */
  staff: (
    role: "owner" | "admin" | "operations" | "finance" | "content" | "support",
  ) => Promise<Session>;
  close: () => Promise<void>;
}

export async function createHarness(env: Record<string, string> = {}): Promise<Harness> {
  const dbName = `pegah_it_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
  const urlFor = (name: string) => {
    const u = new URL(ADMIN_URL!);
    u.pathname = `/${name}`;
    return u.toString();
  };
  const admin = createPrismaClient({ url: urlFor(""), connectionLimit: 1 });
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
    ...env,
  });
  const app = await createApp({ config, quiet: true });
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  const db = app.get<PrismaClient>(PRISMA);

  const today = dhakaToday();
  const dest = await db.destination.create({
    data: {
      slug: "it-dest",
      name: "IT Dest",
      region: "Test",
      summary: "Test",
      status: "PUBLISHED",
    },
  });
  const hotel = await db.hotel.create({
    data: {
      publicId: newPublicId(),
      slug: "it-hotel",
      name: "IT Hotel",
      destinationId: dest.id,
      addressLine: "Test",
      summary: "Test",
      cancellationPolicy: "Test",
      serviceChargeBps: 1000,
      vatBps: 1500,
      status: "PUBLISHED",
    },
  });
  const room = await db.hotelRoom.create({
    data: {
      publicId: newPublicId(),
      hotelId: hotel.id,
      name: "Deluxe",
      description: "Deluxe",
      maxAdults: 2,
      maxChildren: 1,
      bedType: "King",
    },
  });
  const nights = Array.from({ length: 30 }, (_, i) => addDays(today, i));
  await db.roomInventory.createMany({
    data: nights.map((stayDate) => ({ roomId: room.id, stayDate, total: 5 })),
  });
  await db.roomRate.createMany({
    data: nights.map((stayDate) => ({ roomId: room.id, stayDate, amountMinor: taka(8500) })),
  });
  const tour = await db.tour.create({
    data: {
      publicId: newPublicId(),
      slug: "it-tour",
      destinationId: dest.id,
      title: "IT Tour",
      summary: "Test",
      description: "Test",
      durationDays: 2,
      durationNights: 1,
      meetingPoint: "Ghat",
      groupSizeMax: 10,
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
      capacity: 10,
      priceAdultMinor: taka(10000),
      priceChildMinor: taka(6000),
    },
  });

  const call: Harness["call"] = (method, url, opts = {}) =>
    app.inject({
      method,
      url: url.startsWith("/api/") ? url : `/api/v1${url}`,
      headers: {
        origin: ORIGIN,
        ...(opts.session ? { cookie: opts.session.cookie, "x-csrf-token": opts.session.csrf } : {}),
        ...(opts.form ? { "content-type": "application/x-www-form-urlencoded" } : {}),
        ...opts.headers,
      },
      ...(opts.form
        ? { payload: new URLSearchParams(opts.form).toString() }
        : opts.body !== undefined
          ? { payload: opts.body as object }
          : {}),
    });

  const register = async (email: string): Promise<Session> => {
    const res = await call("POST", "/auth/register", {
      body: { email, password: "correct-horse-battery", fullName: "Test Traveller" },
    });
    expect(res.statusCode).toBe(201);
    const raw = res.headers["set-cookie"];
    const list = (Array.isArray(raw) ? raw : [raw]) as string[];
    return {
      cookie: list.find((c) => c.startsWith("pg_sid="))!.split(";")[0]!,
      csrf: res.json().csrfToken as string,
    };
  };

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
  const passwordHash = await app.get(PasswordService).hash("staff-password-123");
  const staff: Harness["staff"] = async (role) => {
    const email = `${role}-${randomBytes(3).toString("hex")}@pegah.test`;
    const roleRow = await db.role.findUniqueOrThrow({ where: { key: role } });
    await db.user.create({
      data: {
        publicId: newPublicId(),
        email,
        fullName: `${role} person`,
        passwordHash,
        kind: "STAFF",
        roles: { create: [{ roleId: roleRow.id }] },
      },
    });
    const res = await call("POST", "/staff/auth/login", {
      body: { email, password: "staff-password-123" },
    });
    expect(res.statusCode).toBe(200);
    const raw = res.headers["set-cookie"];
    const list = (Array.isArray(raw) ? raw : [raw]) as string[];
    return {
      cookie: list.find((c) => c.startsWith("pg_staff_sid="))!.split(";")[0]!,
      csrf: res.json().csrfToken as string,
    };
  };

  return {
    app,
    db,
    staff,
    roomId: room.publicId,
    departureId: schedule.publicId,
    call,
    register,
    close: async () => {
      await app.close();
      await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS \`${dbName}\``);
      await admin.$disconnect();
    },
  };
}
