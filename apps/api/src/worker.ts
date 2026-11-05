/**
 * pegah-worker: the same application code as the API, started without an
 * HTTP listener, running the background jobs (hold expiry and the email
 * outbox; payment reconciliation runs inside the hold sweep). Business rules
 * stay in one codebase; only the process differs (ADR-0027).
 *
 *   node apps/api/dist/worker.js        (systemd: pegah-worker.service)
 */
import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { loadConfig } from "./config/config";
import { setProcessRole } from "./metrics/metrics.service";

async function main(): Promise<void> {
  setProcessRole("worker");
  const config = loadConfig({
    ...process.env,
    // The worker always runs the jobs, even though api.env turns them off for the API.
    RUN_BACKGROUND_JOBS: "true",
    METRICS_PORT: process.env.WORKER_METRICS_PORT ?? "0",
  });
  const app = await NestFactory.createApplicationContext(AppModule.register({ config }), {
    logger: ["error", "warn", "log"],
  });
  app.enableShutdownHooks();
  new Logger("Worker").log(
    `Pegah worker running (holds every ${config.HOLD_SWEEP_SECONDS}s, outbox every ${config.OUTBOX_POLL_SECONDS}s)`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
