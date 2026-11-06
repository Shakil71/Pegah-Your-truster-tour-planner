// Verifies a legacy import (ADR-0038): every source row of every imported table
// is in legacy_records with every field unchanged (credentials excepted), and
// every row that became a catalog/customer row points at a row that exists.
//   DATABASE_URL=… node apps/api/scripts/verify-legacy-import.mjs <dump.sql>
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createPrismaClient } from "@pegah/db";
import { parseDump } from "../dist/legacy/sql-dump.js";

const SKIP = new Set([
  "sessions",
  "otp_sent_mobiles",
  "password_resets",
  "jobs",
  "failed_jobs",
  "migrations",
]);
const SECRET = new Set([
  "password",
  "remember_token",
  "session_id",
  "otp_code",
  "national_id",
  "passport_number",
]);
const dump = parseDump(readFileSync(process.argv[2], "utf8"));
const db = createPrismaClient({ url: process.env.DATABASE_URL, connectionLimit: 2 });
let problems = 0;
const fail = (m) => {
  problems++;
  if (problems <= 30) console.log("PROBLEM:", m);
};

const records = await db.legacyRecord.findMany();
const byKey = new Map(records.map((r) => [`${r.sourceTable}:${r.sourceId}`, r]));
let rows = 0;
let fields = 0;
for (const [table, list] of Object.entries(dump)) {
  if (SKIP.has(table)) continue;
  for (const r of list) {
    rows++;
    const id =
      r.id ??
      createHash("sha256")
        .update(`${table}:${JSON.stringify(r)}`)
        .digest("hex")
        .slice(0, 32);
    const rec = byKey.get(`${table}:${id}`);
    if (!rec) {
      fail(`missing ${table}:${id}`);
      continue;
    }
    for (const [k, v] of Object.entries(r)) {
      if (SECRET.has(k)) {
        if (k in rec.payload) fail(`${table}:${id} archived secret field ${k}`);
        continue;
      }
      fields++;
      if (rec.payload[k] !== v) fail(`${table}:${id}.${k} differs`);
    }
  }
}
const finders = {
  hotel: (id) => db.hotel.findUnique({ where: { id } }),
  hotel_room: (id) => db.hotelRoom.findUnique({ where: { id } }),
  tour: (id) => db.tour.findUnique({ where: { id } }),
  offer: (id) => db.offer.findUnique({ where: { id } }),
  user: (id) => db.user.findUnique({ where: { id } }),
  destination: (id) => db.destination.findUnique({ where: { id } }),
  amenity: (id) => db.amenity.findUnique({ where: { id } }),
  promotion: (id) => db.promotion.findUnique({ where: { id } }),
  content_page: (id) => db.contentPage.findUnique({ where: { id } }),
};
let linked = 0;
for (const r of records) {
  if (!r.targetType) continue;
  linked++;
  const find = finders[r.targetType];
  if (!find) fail(`unknown target type ${r.targetType}`);
  else if (!(await find(r.targetId)))
    fail(`${r.sourceTable}:${r.sourceId} → ${r.targetType} ${r.targetId} not found`);
}
console.log(
  `source rows checked: ${rows}, fields compared: ${fields}, archive rows: ${records.length}, linked rows: ${linked}`,
);
console.log(problems === 0 ? "OK: nothing missing, nothing changed." : `${problems} problem(s).`);
await db.$disconnect();
process.exit(problems === 0 ? 0 : 1);
