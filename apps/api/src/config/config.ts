import { z } from "zod";

const booleanString = z
  .enum(["true", "false"])
  .default("false")
  .transform((v) => v === "true");

/**
 * Environment contract for the API. Values come only from the process
 * environment (systemd EnvironmentFile on servers, apps/api/.env locally);
 * nothing secret has a default.
 */
export const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  HOST: z.string().default("127.0.0.1"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_URL: z.string().regex(/^mysql:\/\//, "DATABASE_URL must start with mysql://"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  APP_ORIGINS: z
    .string()
    .default("http://localhost:3000,http://localhost:3001")
    .transform((v) =>
      v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.url())),
  COOKIE_SECURE: booleanString,
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  OPENAPI_ENABLED: booleanString,
  /** Public URL prefix that media storage keys are served under (Nginx). */
  MEDIA_BASE_URL: z.string().default("/media"),
  /** Customer session lifetime (absolute) and idle timeout, in minutes. */
  CUSTOMER_SESSION_TTL_MIN: z.coerce
    .number()
    .int()
    .min(5)
    .default(60 * 24 * 14),
  CUSTOMER_SESSION_IDLE_MIN: z.coerce
    .number()
    .int()
    .min(5)
    .default(60 * 24 * 3),
  /** Staff sessions are shorter (SECURITY_MODEL.md). */
  STAFF_SESSION_TTL_MIN: z.coerce
    .number()
    .int()
    .min(5)
    .default(60 * 12),
  STAFF_SESSION_IDLE_MIN: z.coerce.number().int().min(5).default(30),
  /** Argon2id cost; defaults follow OWASP's minimum and are tuned on the server. */
  ARGON2_MEMORY_KIB: z.coerce.number().int().min(19456).default(19456),
  ARGON2_TIME_COST: z.coerce.number().int().min(2).default(2),
  ARGON2_PARALLELISM: z.coerce.number().int().min(1).default(1),
  /** How long a new booking holds inventory while awaiting payment. */
  BOOKING_HOLD_MINUTES: z.coerce.number().int().min(5).max(60).default(15),
  /** Interval of the hold-expiry sweeper in seconds; 0 disables it (tests). */
  HOLD_SWEEP_SECONDS: z.coerce.number().int().min(0).max(3600).default(60),

  // ── Payments (ADR-0022). Off by default; see docs/operations/SSLCOMMERZ_INTEGRATION.md.
  /** none = online payment disabled; simulator = local/test only (refused in production). */
  PAYMENT_PROVIDER: z.enum(["none", "sslcommerz", "simulator"]).default("none"),
  /** Customer-facing origin for payment return URLs, e.g. https://pegah.example. */
  PUBLIC_BASE_URL: z.url().optional(),
  SSLCOMMERZ_STORE_ID: z.string().min(1).max(64).optional(),
  SSLCOMMERZ_STORE_PASSWORD: z.string().min(1).max(128).optional(),
  SSLCOMMERZ_MODE: z.enum(["sandbox", "live"]).default("sandbox"),
  /** Set to true only after the sandbox checklist passed and the owner approved going live. */
  SSLCOMMERZ_LIVE_APPROVED: booleanString,
  SSLCOMMERZ_PRODUCT_PROFILE: z
    .enum(["general", "non-physical-goods", "travel-vertical"])
    .default("non-physical-goods"),
  /** Extra hold time granted once, when the customer opens the payment page. */
  PAYMENT_HOLD_EXTENSION_MINUTES: z.coerce.number().int().min(0).max(60).default(20),

  // ── Email (ADR-0024). Off by default: messages are recorded as SKIPPED.
  /** none = record only; log = print recipient/subject (development); smtp = send. */
  EMAIL_TRANSPORT: z.enum(["none", "log", "smtp"]).default("none"),
  EMAIL_FROM: z.string().max(200).default("Pegah <no-reply@localhost>"),
  SMTP_HOST: z.string().max(200).optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  /** true = implicit TLS (465); false = STARTTLS on 587 (required, never plain). */
  SMTP_SECURE: booleanString,
  SMTP_USER: z.string().max(200).optional(),
  SMTP_PASSWORD: z.string().max(200).optional(),
  /** Outbox dispatcher interval in seconds; 0 disables it (tests). */
  OUTBOX_POLL_SECONDS: z.coerce.number().int().min(0).max(3600).default(10),

  // ── Worker, Redis and metrics (ADR-0027).
  /**
   * true = this process runs the hold sweeper and email outbox. The API runs
   * them until the dedicated worker (pegah-worker) is installed, which sets
   * this to false for the API; the worker always runs them.
   */
  RUN_BACKGROUND_JOBS: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  /** redis://user:pass@127.0.0.1:6379/0 — shared rate limits. Unset = per-process limits. */
  REDIS_URL: z
    .string()
    .regex(/^rediss?:\/\//, "REDIS_URL must start with redis:// or rediss://")
    .optional(),
  /** Loopback port for Prometheus metrics (0 = off). Never exposed through Nginx. */
  METRICS_PORT: z.coerce.number().int().min(0).max(65535).default(0),
});

export type AppConfig = z.infer<typeof EnvSchema>;

export const APP_CONFIG = Symbol("APP_CONFIG");

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    // Report which variables are wrong, never their values.
    const problems = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid API environment:\n${problems}`);
  }
  const config = parsed.data;
  if (config.NODE_ENV === "production") {
    if (!config.COOKIE_SECURE) throw new Error("COOKIE_SECURE must be true in production");
    if (config.OPENAPI_ENABLED) throw new Error("OPENAPI_ENABLED must be false in production");
    if (config.PAYMENT_PROVIDER === "simulator") {
      throw new Error("PAYMENT_PROVIDER=simulator is for development and tests only");
    }
    if (config.PAYMENT_PROVIDER !== "none" && !config.PUBLIC_BASE_URL?.startsWith("https://")) {
      throw new Error("PUBLIC_BASE_URL must be an https:// URL when payments are enabled");
    }
  }
  if (config.PAYMENT_PROVIDER !== "none" && !config.PUBLIC_BASE_URL) {
    throw new Error("PUBLIC_BASE_URL is required when PAYMENT_PROVIDER is set");
  }
  if (
    config.EMAIL_TRANSPORT === "smtp" &&
    (!config.SMTP_HOST || !config.SMTP_USER || !config.SMTP_PASSWORD)
  ) {
    throw new Error(
      "SMTP_HOST, SMTP_USER and SMTP_PASSWORD are required when EMAIL_TRANSPORT=smtp",
    );
  }
  if (config.PAYMENT_PROVIDER === "sslcommerz") {
    if (!config.SSLCOMMERZ_STORE_ID || !config.SSLCOMMERZ_STORE_PASSWORD) {
      throw new Error("SSLCOMMERZ_STORE_ID and SSLCOMMERZ_STORE_PASSWORD are required");
    }
    if (config.SSLCOMMERZ_MODE === "live" && !config.SSLCOMMERZ_LIVE_APPROVED) {
      throw new Error(
        "SSLCOMMERZ_MODE=live requires SSLCOMMERZ_LIVE_APPROVED=true (owner approval)",
      );
    }
  }
  return config;
}
