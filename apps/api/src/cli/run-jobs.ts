/**
 * Runs every background job once and exits (ADR-0040). For hosts that cannot
 * keep a worker process alive (cPanel shared hosting), a cron job runs this
 * every minute instead of pegah-worker:
 *
 *   * * * * *  cd ~/pegah/api && node dist/cli/run-jobs.js >> ~/pegah/logs/jobs.log 2>&1
 *
 * Each job is idempotent and uses row locks, so an overlapping run is safe;
 * a lock file still prevents two runs from piling up on a slow host.
 */
import "reflect-metadata";
import { closeSync, existsSync, openSync, statSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { HoldExpiryService } from "../booking/hold-expiry.service";
import { OrderService } from "../commerce/order.service";
import { loadConfig } from "../config/config";
import { OutboxDispatcher } from "../email/outbox-dispatcher.service";
import { ServiceRequestService } from "../services/service-request.service";

const LOCK = path.join(process.env.PEGAH_JOBS_LOCK_DIR ?? tmpdir(), "pegah-run-jobs.lock");
const STALE_MS = 10 * 60_000;

function takeLock(): boolean {
  if (existsSync(LOCK) && Date.now() - statSync(LOCK).mtimeMs > STALE_MS) unlinkSync(LOCK);
  try {
    closeSync(openSync(LOCK, "wx"));
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  if (!takeLock()) {
    process.stdout.write("run-jobs: previous run still active; skipping\n");
    return;
  }
  // No timers in this process: each job runs exactly once below.
  const config = loadConfig({ ...process.env, RUN_BACKGROUND_JOBS: "false", METRICS_PORT: "0" });
  const app = await NestFactory.createApplicationContext(AppModule.register({ config }), {
    logger: ["error", "warn"],
  });
  try {
    const expired = await app.get(HoldExpiryService).sweep();
    const orders = await app.get(OrderService).expireDue();
    let emails = 0;
    for (let i = 0; i < 10; i++) {
      const n = await app.get(OutboxDispatcher).drain();
      emails += n;
      if (n === 0) break;
    }
    const purged = await app.get(ServiceRequestService).purgeDocuments();
    process.stdout.write(
      `${new Date().toISOString()} run-jobs: holds expired ${expired}, orders expired ${orders}, events sent ${emails}, document sets purged ${purged}\n`,
    );
  } finally {
    await app.close();
    unlinkSync(LOCK);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
