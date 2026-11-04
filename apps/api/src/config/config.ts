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
  }
  return config;
}
