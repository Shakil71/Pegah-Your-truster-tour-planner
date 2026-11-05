/* In-memory stand-in for the Prisma client, covering only the calls the auth
 * and booking-status paths make. It lets the HTTP-level tests run in CI with
 * no MySQL. Real-database behaviour is covered by the integration script. */
import { Prisma } from "@pegah/db";

type Row = Record<string, unknown> & { id: bigint };

let seq = 0n;
const nextId = () => ++seq;

function matches(row: Row, where: Record<string, unknown> | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, cond]) => {
    if (key === "AND") return (cond as Record<string, unknown>[]).every((w) => matches(row, w));
    if (cond !== null && typeof cond === "object" && !(cond instanceof Date)) {
      const c = cond as { lt?: bigint };
      if (c.lt !== undefined) return (row[key] as bigint) < c.lt;
      return false;
    }
    return row[key] === cond;
  });
}

export interface FakeDb {
  users: Row[];
  sessions: Row[];
  audits: Row[];
  bookings: Row[];
  history: Row[];
  grants: { userId: bigint; roleKey: string; permissions: string[] }[];
  client: unknown;
}

export function createFakeDb(): FakeDb {
  const state: FakeDb = {
    users: [],
    sessions: [],
    audits: [],
    bookings: [],
    history: [],
    grants: [],
    client: undefined,
  };
  const now = () => new Date();

  const client = {
    user: {
      findUnique: async ({ where }: { where: Record<string, unknown> }) =>
        state.users.find((u) => matches(u, where)) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        if (state.users.some((u) => u.email === data.email)) {
          throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
            code: "P2002",
            clientVersion: "fake",
          });
        }
        const row: Row = {
          id: nextId(),
          status: "ACTIVE",
          kind: "CUSTOMER",
          phone: null,
          lastLoginAt: null,
          createdAt: now(),
          updatedAt: now(),
          ...data,
        };
        state.users.push(row);
        return row;
      },
      update: async ({ where, data }: { where: { id: bigint }; data: Record<string, unknown> }) => {
        const row = state.users.find((u) => u.id === where.id)!;
        Object.assign(row, data);
        return row;
      },
    },
    session: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row: Row = { id: nextId(), revokedAt: null, createdAt: now(), ...data };
        state.sessions.push(row);
        return { id: row.id };
      },
      findUnique: async ({ where }: { where: { tokenHash: string } }) => {
        const s = state.sessions.find((x) => x.tokenHash === where.tokenHash);
        if (!s) return null;
        return { ...s, user: state.users.find((u) => u.id === s.userId) };
      },
      update: async ({ where, data }: { where: { id: bigint }; data: Record<string, unknown> }) => {
        const row = state.sessions.find((s) => s.id === where.id)!;
        Object.assign(row, data);
        return row;
      },
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: object }) => {
        const rows = state.sessions.filter((s) => matches(s, where));
        rows.forEach((r) => Object.assign(r, data));
        return { count: rows.length };
      },
    },
    userRole: {
      findMany: async ({ where }: { where: { userId: bigint } }) =>
        state.grants
          .filter((g) => g.userId === where.userId)
          .map((g) => ({
            role: {
              key: g.roleKey,
              permissions: g.permissions.map((key) => ({ permission: { key } })),
            },
          })),
    },
    auditEvent: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row: Row = { id: nextId(), createdAt: now(), ...data };
        state.audits.push(row);
        return row;
      },
    },
    booking: {
      findUnique: async ({ where }: { where: { publicId: string } }) => {
        const b = state.bookings.find((x) => x.publicId === where.publicId);
        return b ? { ...b } : null; // Prisma returns copies, never live rows
      },
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        const b = state.bookings.find((x) => matches(x, where));
        if (!b) return null;
        return {
          ...b,
          history: state.history.filter((h) => h.bookingId === b.id),
          items: [],
          guests: [],
          payments: [],
          refunds: [],
          promotion: null,
          agent: null,
          user: {
            publicId: "01JBX00000000000000000CSTM",
            fullName: "Test Traveller",
            email: "traveller@pegah.test",
          },
        };
      },
      findMany: async ({ where, take }: { where: Record<string, unknown>; take: number }) =>
        state.bookings
          .filter((b) => matches(b, where))
          .sort((a, b) => (a.id < b.id ? 1 : -1))
          .slice(0, take),
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: object }) => {
        const rows = state.bookings.filter((b) => matches(b, where));
        rows.forEach((r) => Object.assign(r, data));
        return { count: rows.length };
      },
    },
    inventoryHold: {
      findMany: async () => [],
      updateMany: async () => ({ count: 0 }),
    },
    bookingStatusHistory: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row: Row = { id: nextId(), createdAt: now(), ...data };
        state.history.push(row);
        return row;
      },
    },
    // Single-threaded fake: run the callback against the same client.
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>) => fn(client),
    $queryRaw: async () => [{ 1: 1 }],
    $disconnect: async () => undefined,
  };
  state.client = client;
  return state;
}

export function addBooking(db: FakeDb, overrides: Record<string, unknown>): Row {
  const row: Row = {
    id: nextId(),
    publicId: "01JBX0000000000000000000AA",
    reference: "PG-TEST01",
    status: "MANUAL_REVIEW",
    productType: "HOTEL",
    productName: "Tea Garden Resort",
    startDate: new Date("2026-12-10T00:00:00Z"),
    endDate: new Date("2026-12-12T00:00:00Z"),
    guestCount: 2,
    currency: "BDT",
    baseMinor: 3_400_000n,
    serviceChargeMinor: 340_000n,
    vatMinor: 561_000n,
    discountMinor: 0n,
    totalMinor: 4_301_000n,
    contactName: "Test Traveller",
    contactEmail: "traveller@pegah.test",
    contactPhone: "+8801711000000",
    holdExpiresAt: null,
    createdAt: new Date("2026-11-01T10:00:00Z"),
    ...overrides,
  };
  db.bookings.push(row);
  return row;
}
