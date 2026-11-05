import { Logger, type OnApplicationShutdown } from "@nestjs/common";
import { ThrottlerStorageService, type ThrottlerStorage } from "@nestjs/throttler";
import Redis from "ioredis";
import { Counter } from "prom-client";
import { registry } from "../metrics/metrics.service";

/** Registered in docs/architecture/SYSTEM_ARCHITECTURE.md#cache. */
export const RATE_LIMIT_PREFIX = "pegah:v1:ratelimit:";

// Atomic fixed window: count the hit, start the window on the first hit.
const INCREMENT = `
local hits = redis.call('INCR', KEYS[1])
if hits == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('PTTL', KEYS[1])
return {hits, ttl}
`;

const fallbacks = new Counter({
  name: "pegah_ratelimit_redis_fallback_total",
  help: "Rate-limit checks answered by the per-process fallback because Redis failed",
  registers: [registry],
});

/**
 * Rate limits shared by every API process, kept in Redis. Redis is never the
 * source of truth for business data; if it is unreachable, limits fall back
 * to the per-process in-memory store (still enforced, never switched off) and
 * a warning is logged.
 */
export class RedisThrottlerStorage implements ThrottlerStorage, OnApplicationShutdown {
  private readonly logger = new Logger("RateLimit");
  private readonly redis: Redis;
  private readonly fallback = new ThrottlerStorageService();
  private lastWarning = 0;

  constructor(url: string) {
    this.redis = new Redis(url, {
      connectTimeout: 2000,
      maxRetriesPerRequest: 1,
      // Fail fast while disconnected instead of queueing requests behind a dead link.
      enableOfflineQueue: false,
      lazyConnect: false,
    });
    this.redis.on("error", (error: Error) => this.warn(error));
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): ReturnType<ThrottlerStorage["increment"]> {
    try {
      const [hits, pttl] = (await this.redis.eval(
        INCREMENT,
        1,
        `${RATE_LIMIT_PREFIX}${throttlerName}:${key}`,
        String(ttl),
      )) as [number, number];
      const seconds = Math.max(1, Math.ceil(pttl / 1000));
      const isBlocked = hits > limit;
      return {
        totalHits: hits,
        timeToExpire: seconds,
        isBlocked,
        timeToBlockExpire: isBlocked ? seconds : 0,
      };
    } catch (error) {
      fallbacks.inc();
      this.warn(error);
      return this.fallback.increment(key, ttl, limit, blockDuration, throttlerName);
    }
  }

  async onApplicationShutdown(): Promise<void> {
    this.fallback.onApplicationShutdown();
    await this.redis.quit().catch(() => undefined);
  }

  /** At most one warning a minute, without the connection URL. */
  private warn(error: unknown): void {
    const now = Date.now();
    if (now - this.lastWarning < 60_000) return;
    this.lastWarning = now;
    this.logger.warn(
      { err: error instanceof Error ? error.message : String(error) },
      "Redis unavailable; using per-process rate limits",
    );
  }
}
