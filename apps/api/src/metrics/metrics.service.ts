import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { createServer, type Server } from "node:http";
import { collectDefaultMetrics, Gauge, Histogram, Registry } from "prom-client";
import { APP_CONFIG, type AppConfig } from "../config/config";
import { PRISMA, type Db } from "../prisma/prisma.service";

/** "api" or "worker"; set by the process entrypoint before the app starts. */
let processRole: "api" | "worker" = "api";
export function setProcessRole(role: "api" | "worker"): void {
  processRole = role;
}

/** One registry per process; every metric carries the process role. */
export const registry = new Registry();
let collectorsRegistered = false;

/** HTTP latency by route pattern (never the raw URL, so labels stay bounded). */
export const httpDuration = new Histogram({
  name: "pegah_http_request_duration_seconds",
  help: "API request duration by method, route pattern and status class",
  labelNames: ["method", "route", "status"] as const,
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [registry],
});

/**
 * Prometheus metrics on a loopback-only port (METRICS_PORT). Process metrics
 * everywhere; business gauges (holds, outbox, payments needing attention) only
 * in the process that runs background jobs, so they are reported once.
 * Nothing here is reachable through Nginx.
 */
@Injectable()
export class MetricsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger("Metrics");
  private server: Server | undefined;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(PRISMA) private readonly db: Db,
  ) {}

  onModuleInit(): void {
    if (this.config.METRICS_PORT === 0) return;
    if (!collectorsRegistered) {
      collectorsRegistered = true;
      registry.setDefaultLabels({ role: processRole });
      collectDefaultMetrics({ register: registry, prefix: "pegah_" });
      if (this.config.RUN_BACKGROUND_JOBS) this.registerBusinessGauges();
    }

    this.server = createServer((req, res) => {
      if (req.method !== "GET" || req.url !== "/metrics") {
        res.writeHead(404).end();
        return;
      }
      registry
        .metrics()
        .then((body) => {
          res.writeHead(200, { "content-type": registry.contentType }).end(body);
        })
        .catch((error: unknown) => {
          this.logger.warn({ err: error }, "Metrics collection failed");
          res.writeHead(500).end();
        });
    });
    this.server.listen(this.config.METRICS_PORT, "127.0.0.1");
    this.server.unref();
  }

  onModuleDestroy(): void {
    this.server?.close();
  }

  private registerBusinessGauges(): void {
    const db = this.db;
    const gauge = (name: string, help: string, read: () => Promise<number>) =>
      new Gauge({
        name,
        help,
        registers: [registry],
        async collect() {
          try {
            this.set(await read());
          } catch {
            // Database briefly unavailable: report nothing rather than a wrong zero.
            this.reset();
          }
        },
      });
    gauge("pegah_bookings_held", "Bookings held and awaiting payment", () =>
      db.booking.count({ where: { status: "PENDING_PAYMENT" } }),
    );
    gauge("pegah_bookings_manual_review", "Bookings waiting for a staff check", () =>
      db.booking.count({ where: { status: "MANUAL_REVIEW" } }),
    );
    gauge("pegah_payments_refund_required", "Payments that must be refunded", () =>
      db.payment.count({ where: { status: "REFUND_REQUIRED" } }),
    );
    gauge("pegah_outbox_pending", "Outbox events not yet dispatched", () =>
      db.outboxEvent.count({ where: { status: { in: ["PENDING", "PROCESSING"] } } }),
    );
    gauge("pegah_outbox_failed", "Outbox events that gave up after retries", () =>
      db.outboxEvent.count({ where: { status: "FAILED" } }),
    );
    gauge("pegah_email_failed", "Emails that failed to send", () =>
      db.emailMessage.count({ where: { status: "FAILED" } }),
    );
  }
}
