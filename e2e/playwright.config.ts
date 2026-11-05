import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end suite against the real stack: API (simulator payments, no email),
 * website and console, all built beforehand (`npx turbo run build`), on a
 * database prepared by `node e2e/prepare.mjs`. Everything goes through the
 * website origin, like Nginx in production: /api → API, /admin → console.
 */
const root = resolve(__dirname, "..");
const stack = JSON.parse(readFileSync(resolve(__dirname, ".state/stack.json"), "utf8")) as {
  databaseUrl: string;
};
const BASE = "http://localhost:3000";
const next = (app: string, port: number) => ({
  command: `node ../../node_modules/next/dist/bin/next start -p ${port}`,
  cwd: resolve(root, "apps", app),
  url: `http://localhost:${port}${app === "admin" ? "/admin/login" : "/"}`,
  env: { NEXT_TELEMETRY_DISABLED: "1", API_INTERNAL_URL: "http://127.0.0.1:4000" },
  reuseExistingServer: false,
  timeout: 120_000,
});

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  // In CI, "github" turns each failure into an annotation on the check run.
  reporter: process.env.CI ? [["github"], ["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, grep: /@mobile/ },
  ],
  webServer: [
    {
      command: "node dist/main.js",
      cwd: resolve(root, "apps/api"),
      url: "http://127.0.0.1:4000/api/v1/health/live",
      env: {
        NODE_ENV: "development",
        PORT: "4000",
        LOG_LEVEL: "warn",
        DATABASE_URL: stack.databaseUrl,
        SESSION_SECRET: randomBytes(32).toString("base64url"),
        PAYMENT_PROVIDER: "simulator",
        PUBLIC_BASE_URL: BASE,
        EMAIL_TRANSPORT: "none",
        APP_ORIGINS: "http://localhost:3000,http://localhost:3001",
      },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    next("admin", 3001),
    next("web", 3000),
  ],
});
