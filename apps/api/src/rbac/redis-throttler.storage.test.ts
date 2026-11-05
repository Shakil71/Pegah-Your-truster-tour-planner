import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { RedisThrottlerStorage } from "./redis-throttler.storage";

describe("rate limits when Redis is unreachable", () => {
  // Port 1 refuses connections: every Redis call fails at once.
  const storage = new RedisThrottlerStorage("redis://127.0.0.1:1/0");
  afterAll(() => storage.onApplicationShutdown());

  it("still enforce the limit with the per-process fallback (never fail open)", async () => {
    const key = randomUUID();
    const results = [];
    for (let i = 0; i < 6; i++) {
      results.push(await storage.increment(key, 60_000, 5, 60_000, "default"));
    }
    expect(results.slice(0, 5).every((r) => !r.isBlocked)).toBe(true);
    expect(results[5]!.isBlocked).toBe(true);
  });
});

const REDIS_URL = process.env.PEGAH_IT_REDIS_URL;

describe.skipIf(!REDIS_URL)("rate limits in a real Redis", () => {
  const storage = new RedisThrottlerStorage(REDIS_URL ?? "redis://127.0.0.1:6379");
  afterAll(() => storage.onApplicationShutdown());

  it("share one fixed window across instances and expire it", async () => {
    const other = new RedisThrottlerStorage(REDIS_URL!);
    expect(await storage.ready()).toBe(true);
    expect(await other.ready()).toBe(true);
    const key = randomUUID();
    const a = await storage.increment(key, 1000, 2, 1000, "default");
    const b = await other.increment(key, 1000, 2, 1000, "default");
    const c = await storage.increment(key, 1000, 2, 1000, "default");
    expect([a.totalHits, b.totalHits, c.totalHits]).toEqual([1, 2, 3]);
    expect(c.isBlocked).toBe(true);
    expect(c.timeToBlockExpire).toBeGreaterThan(0);
    await new Promise((r) => setTimeout(r, 1100));
    const d = await other.increment(key, 1000, 2, 1000, "default");
    expect(d).toMatchObject({ totalHits: 1, isBlocked: false });
    await other.onApplicationShutdown();
  });
});
