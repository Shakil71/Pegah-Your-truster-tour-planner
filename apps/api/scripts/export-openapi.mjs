// Writes the OpenAPI document (generated from the Zod contracts) to openapi.json.
// packages/api-client will be generated from this file. Needs `npm run build` first.
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createApp, buildOpenApi } = require("../dist/app.factory.js");
const { loadConfig } = require("../dist/config/config.js");

// No database connection is made; these values only satisfy config validation.
const config = loadConfig({
  DATABASE_URL: "mysql://openapi@127.0.0.1:3306/openapi",
  SESSION_SECRET: "openapi-export-only-not-a-secret-value",
  LOG_LEVEL: "silent",
});
const app = await createApp({ config, quiet: true });
const doc = buildOpenApi(app);
writeFileSync("openapi.json", JSON.stringify(doc, null, 2) + "\n");
await app.close();
console.log(`openapi.json written (${Object.keys(doc.paths).length} paths)`);
