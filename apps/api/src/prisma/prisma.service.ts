import { Inject, Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { createPrismaClient, type PrismaClient } from "@pegah/db";
import { APP_CONFIG, type AppConfig } from "../config/config";

/** Injection token for the Prisma client (overridden with a fake in tests). */
export const PRISMA = Symbol("PRISMA");
export type Db = PrismaClient;

/**
 * Owns the process-wide Prisma client. It connects lazily on first query so
 * the API can start (and report not-ready) while MySQL is unavailable.
 */
@Injectable()
export class PrismaLifecycle implements OnModuleDestroy {
  private readonly logger = new Logger("Prisma");

  constructor(@Inject(PRISMA) private readonly db: Db) {}

  async onModuleDestroy(): Promise<void> {
    await this.db.$disconnect();
    this.logger.log("Disconnected");
  }
}

export function prismaFactory(config: AppConfig): Db {
  return createPrismaClient({
    url: config.DATABASE_URL,
    log: config.NODE_ENV !== "production",
  });
}

export const prismaProvider = {
  provide: PRISMA,
  inject: [APP_CONFIG],
  useFactory: prismaFactory,
};
