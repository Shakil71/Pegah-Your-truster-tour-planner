import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "./generated/prisma/client";

export * from "./generated/prisma/client";

export interface CreatePrismaClientOptions {
  /** mysql://user:password@host:3306/database — supplied from the environment. */
  url: string;
  /** Connection pool size per process. */
  connectionLimit?: number;
  log?: boolean;
}

/**
 * Builds a Prisma client over the MariaDB driver adapter, which speaks the
 * MySQL 8.4 protocol (Prisma 7 requires a driver adapter).
 */
export function createPrismaClient(options: CreatePrismaClientOptions): PrismaClient {
  const url = new URL(options.url);
  if (url.protocol !== "mysql:" && url.protocol !== "mariadb:") {
    throw new Error("DATABASE_URL must use the mysql:// scheme");
  }
  const adapter = new PrismaMariaDb({
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    connectionLimit: options.connectionLimit ?? 10,
    // Fail fast when MySQL is down instead of queueing requests for seconds.
    connectTimeout: 3_000,
    acquireTimeout: 5_000,
    // MySQL 8.4 defaults to caching_sha2_password. Over a local socket or TLS
    // this is safe; over plain TCP the server's RSA key is fetched.
    allowPublicKeyRetrieval: url.searchParams.get("allowPublicKeyRetrieval") === "true",
    timezone: "Z",
  });
  return new PrismaClient({
    adapter,
    log: options.log ? ["warn", "error"] : ["error"],
  });
}
