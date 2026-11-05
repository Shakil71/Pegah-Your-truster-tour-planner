import { Controller, Get, Inject, Res } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { HealthResponseSchema, type HealthResponse } from "@pegah/contracts";
import type { FastifyReply } from "fastify";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createZodDto, ZodResponse } from "nestjs-zod";
import { Public } from "../auth/decorators";
import { PRISMA, type Db } from "../prisma/prisma.service";

class HealthResponseDto extends createZodDto(HealthResponseSchema) {}

export const VERSION = process.env.npm_package_version ?? "0.1.0";

/** Written by infra/deploy/deploy.sh at the release root; absent locally. */
function readBuildInfo(): { commit: string | null; builtAt: string | null } {
  try {
    // dist/health (or src/health) → apps/api → apps → release root
    const raw = readFileSync(resolve(__dirname, "../../../../build-info.json"), "utf8");
    const info = JSON.parse(raw) as { commit?: unknown; builtAt?: unknown };
    return {
      commit: typeof info.commit === "string" ? info.commit : null,
      builtAt: typeof info.builtAt === "string" ? info.builtAt : null,
    };
  } catch {
    return { commit: null, builtAt: null };
  }
}
export const BUILD = readBuildInfo();

/** Liveness (process is up) and readiness (dependencies reachable) probes. */
@ApiTags("health")
@Public()
@SkipThrottle()
@Controller("health")
export class HealthController {
  constructor(@Inject(PRISMA) private readonly db: Db) {}

  @Get("live")
  @ZodResponse({ status: 200, type: HealthResponseDto })
  live(): HealthResponse {
    return {
      status: "ok",
      checks: {},
      version: VERSION,
      ...BUILD,
      time: new Date().toISOString(),
    };
  }

  @Get("ready")
  @ZodResponse({
    status: 200,
    type: HealthResponseDto,
    description: "503 when a dependency is down",
  })
  async ready(@Res({ passthrough: true }) reply: FastifyReply): Promise<HealthResponse> {
    let database: "up" | "down" = "up";
    try {
      // Bounded: a dead database must not make the probe itself hang.
      await Promise.race([
        this.db.$queryRaw`SELECT 1`,
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 2000).unref()),
      ]);
    } catch {
      database = "down";
    }
    // 503 tells Nginx/monitoring to stop routing here; the body explains why.
    if (database === "down") void reply.status(503);
    void reply.header("cache-control", "no-store");
    return {
      status: database === "up" ? "ok" : "down",
      checks: { database },
      version: VERSION,
      ...BUILD,
      time: new Date().toISOString(),
    };
  }
}
