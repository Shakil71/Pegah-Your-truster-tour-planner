// Prepares a fresh database for the end-to-end suite: real migrations, roles,
// the labelled demo catalog, draft content pages and one owner account with a
// random password. Writes e2e/.state/stack.json (gitignored) for the tests.
//
//   PEGAH_E2E_DATABASE_URL=mysql://user:pass@127.0.0.1:3307/ node e2e/prepare.mjs
//
// The URL points at the server, not a database; the user needs rights on
// `pegah_it_%` databases (the same grant the integration tests use).
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const server = process.env.PEGAH_E2E_DATABASE_URL ?? process.env.PEGAH_IT_DATABASE_URL;
if (!server?.startsWith("mysql://")) {
  console.error("Set PEGAH_E2E_DATABASE_URL=mysql://user:pass@host:port/ (server URL).");
  process.exit(2);
}

const DB_NAME = "pegah_it_e2e";
const require = createRequire(import.meta.url);
const mariadb = require("mariadb");
const u = new URL(server);
const conn = await mariadb.createConnection({
  host: u.hostname,
  port: Number(u.port || 3306),
  user: decodeURIComponent(u.username),
  password: decodeURIComponent(u.password),
  allowPublicKeyRetrieval: true,
});
await conn.query(`DROP DATABASE IF EXISTS \`${DB_NAME}\``);
await conn.query(`CREATE DATABASE \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
await conn.end();

const dbUrl = new URL(server);
dbUrl.pathname = `/${DB_NAME}`;
const databaseUrl = dbUrl.toString();
const env = { ...process.env, DATABASE_URL: databaseUrl, NODE_ENV: "development" };
const step = (label, file, args, cwd = root) => {
  console.log(`e2e prepare: ${label}`);
  execFileSync(process.execPath, [file, ...args], {
    cwd,
    env,
    stdio: ["ignore", "ignore", "inherit"],
  });
};

const dbPackage = resolve(root, "packages/db");
const prismaCli = createRequire(resolve(dbPackage, "package.json")).resolve(
  "prisma/build/index.js",
);
step("migrations", prismaCli, ["migrate", "deploy"], dbPackage);
const cli = (name) => resolve(root, "apps/api/dist/cli", `${name}.js`);
step("roles", cli("seed-rbac"), []);
step("demo catalog", cli("seed-sample"), []);
step("content drafts", cli("seed-content"), []);

const staffEmail = "e2e-owner@example.com";
const staffPassword = randomBytes(18).toString("base64url");
env.PEGAH_STAFF_PASSWORD = staffPassword;
step("owner account", cli("create-staff"), [
  "--email",
  staffEmail,
  "--name",
  "E2E Owner",
  "--role",
  "owner",
]);

mkdirSync(resolve(root, "e2e/.state"), { recursive: true });
writeFileSync(
  resolve(root, "e2e/.state/stack.json"),
  JSON.stringify({ databaseUrl, staffEmail, staffPassword }, null, 2),
  { mode: 0o600 },
);
console.log("e2e prepare: done");
