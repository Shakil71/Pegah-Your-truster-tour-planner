/* Every application table must be InnoDB (transactions, row locks, foreign keys), even on
 * hosts whose default storage engine is MyISAM (ADR-0040). Prisma's own _prisma_migrations
 * bookkeeping table follows the host default and holds no business data. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ADMIN_URL, createHarness, type Harness } from "./int-harness";

describe.skipIf(!ADMIN_URL)("schema storage engine", () => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness();
  }, 120_000);
  afterAll(() => h?.close());

  it("creates every table as InnoDB with its foreign keys", async () => {
    const rows = await h.db.$queryRaw<Array<{ name: string; engine: string }>>`
      SELECT TABLE_NAME AS name, ENGINE AS engine FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
        AND TABLE_NAME <> '_prisma_migrations'`;
    expect(rows.length).toBeGreaterThan(50);
    expect(rows.filter((r) => r.engine !== "InnoDB").map((r) => r.name)).toEqual([]);
    const fks = await h.db.$queryRaw<Array<{ n: bigint }>>`
      SELECT COUNT(*) AS n FROM information_schema.REFERENTIAL_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()`;
    expect(Number(fks[0]!.n)).toBeGreaterThan(50);
  });
});
