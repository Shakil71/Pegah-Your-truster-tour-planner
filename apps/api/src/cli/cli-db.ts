import { createPrismaClient, type PrismaClient } from "@pegah/db";

/** Database client for operator CLIs. DATABASE_URL comes from the environment only. */
export function cliDb(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url || !url.startsWith("mysql://")) {
    console.error("DATABASE_URL (mysql://…) must be set in the environment.");
    process.exit(2);
  }
  return createPrismaClient({ url, connectionLimit: 2 });
}

export function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

export async function run(main: () => Promise<void>, db?: PrismaClient): Promise<void> {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await db?.$disconnect();
  }
}
