import "reflect-metadata";
import fastifyCookie from "@fastify/cookie";
import fastifyHelmet from "@fastify/helmet";
import type { Provider } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from "@nestjs/swagger";
import { cleanupOpenApiDoc } from "nestjs-zod";
import { randomUUID } from "node:crypto";
import { AppModule } from "./app.module";
import type { AppConfig } from "./config/config";

export const API_PREFIX = "api/v1";

export interface CreateAppOptions {
  config: AppConfig;
  prisma?: Provider;
  /** Silence Nest's bootstrap logs (tests). */
  quiet?: boolean;
}

/** Builds the fully configured API (used by main.ts, tests and OpenAPI export). */
export async function createApp({
  config,
  prisma,
  quiet,
}: CreateAppOptions): Promise<NestFastifyApplication> {
  const adapter = new FastifyAdapter({
    // Trust exactly N proxy hops (Nginx) for client IPs; never all of X-Forwarded-For.
    trustProxy: (_address: string, hop: number) => hop < config.TRUST_PROXY_HOPS,
    bodyLimit: 100 * 1024,
    genReqId: () => randomUUID(),
    logger:
      config.LOG_LEVEL === "silent"
        ? false
        : {
            level: config.LOG_LEVEL,
            // Never log credentials, session cookies or CSRF tokens.
            redact: {
              paths: [
                "req.headers.cookie",
                "req.headers.authorization",
                'req.headers["x-csrf-token"]',
                'res.headers["set-cookie"]',
              ],
              censor: "[redacted]",
            },
          },
  });

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.register({ config, prisma }),
    adapter,
    { logger: quiet ? false : ["error", "warn", "log"], bufferLogs: false },
  );

  app.setGlobalPrefix(API_PREFIX);
  app.enableShutdownHooks();
  app.enableCors({
    origin: config.APP_ORIGINS,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["content-type", "x-csrf-token", "idempotency-key"],
    maxAge: 600,
  });

  await app.register(fastifyCookie);
  await app.register(fastifyHelmet, {
    // JSON API: nothing to render, so the strictest CSP is fine.
    contentSecurityPolicy: {
      directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
    },
    hsts: config.COOKIE_SECURE ? { maxAge: 31_536_000, includeSubDomains: true } : false,
    referrerPolicy: { policy: "no-referrer" },
    crossOriginResourcePolicy: { policy: "same-site" },
  });

  if (config.OPENAPI_ENABLED) {
    const document = buildOpenApi(app);
    app
      .getHttpAdapter()
      .getInstance()
      .get(`/${API_PREFIX}/docs/openapi.json`, (_req, reply) => {
        void reply.header("cache-control", "no-store").send(document);
      });
  }

  return app;
}

export function buildOpenApi(app: NestFastifyApplication): OpenAPIObject {
  const doc = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle("Pegah API")
      .setDescription(
        "Pegah travel platform API. Money is integer minor units with a currency; " +
          "timestamps are ISO 8601 UTC; errors are RFC 9457 problem details.",
      )
      .setVersion("0.1.0")
      .addCookieAuth("pg_sid", { type: "apiKey", in: "cookie" }, "customer")
      .addCookieAuth("pg_staff_sid", { type: "apiKey", in: "cookie" }, "staff")
      .build(),
  );
  return cleanupOpenApiDoc(doc);
}
