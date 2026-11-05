/* Prometheus metrics against MySQL 8.4: loopback-only port, request latency
 * by route pattern, business gauges from the process that runs the jobs. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ADMIN_URL, createHarness, type Harness } from "./int-harness";

const PORT = 19_464;

describe.skipIf(!ADMIN_URL)("metrics against MySQL 8.4", () => {
  let h: Harness;

  beforeAll(async () => {
    h = await createHarness({ METRICS_PORT: String(PORT) });
  }, 120_000);
  afterAll(() => h?.close());

  it("exposes process, request and booking metrics on the loopback port", async () => {
    await h.call("GET", "/health/live");
    const res = await fetch(`http://127.0.0.1:${PORT}/metrics`);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toMatch(/pegah_process_cpu_seconds_total\{role="api"\}/);
    expect(body).toMatch(
      /pegah_http_request_duration_seconds_count\{[^}]*route="\/api\/v1\/health\/live"[^}]*\} [1-9]/,
    );
    expect(body).toMatch(/pegah_bookings_held\{role="api"\} \d+/);
    expect(body).toMatch(/pegah_outbox_failed\{role="api"\} \d+/);
    // Raw URLs, ids and query strings never become labels.
    expect(body).not.toMatch(/route="[^"]*\?/);
  });

  it("answers nothing but /metrics", async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/`);
    expect(res.status).toBe(404);
  });
});
