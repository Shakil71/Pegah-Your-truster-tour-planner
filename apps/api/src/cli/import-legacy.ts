/**
 * Imports the old Pegah website (Laravel/MariaDB dump + its images folder)
 * into this database (ADR-0038). See legacy/importer.ts for the safety rules.
 *
 *   node dist/cli/import-legacy.js --dump <file.sql> --images <dir> [--dry-run]
 *   NODE_ENV=production … --confirm-production       # server, owner-approved, after a backup
 *
 * Then check: node scripts/verify-legacy-import.mjs <file.sql>
 */
import { existsSync, readFileSync } from "node:fs";
import { importLegacy } from "../legacy/importer";
import { parseDump } from "../legacy/sql-dump";
import { arg, cliDb, run } from "./cli-db";

const flag = (name: string) => process.argv.includes(`--${name}`);

async function main() {
  const dumpFile = arg("dump");
  const imagesDir = arg("images");
  const dryRun = flag("dry-run");
  if (!dumpFile || !existsSync(dumpFile))
    throw new Error("--dump <file.sql> is required and must exist");
  if (!imagesDir || !existsSync(imagesDir))
    throw new Error("--images <dir> is required and must exist");
  if (process.env.NODE_ENV === "production" && !dryRun && !flag("confirm-production")) {
    throw new Error(
      "Refusing to import into production without --confirm-production (take a backup first).",
    );
  }
  const dump = parseDump(readFileSync(dumpFile, "utf8"));
  const db = cliDb();
  try {
    const report = await importLegacy(db, dump, imagesDir, { dryRun });
    report.print(dryRun);
  } finally {
    await db.$disconnect();
  }
}

void run(main);
