import { defineConfig } from "prisma/config";

// DATABASE_URL comes from the environment only (never committed). It is not
// needed for `prisma generate` or offline `migrate diff`, so it is optional
// here; commands that talk to a database fail clearly without it.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  ...(process.env.DATABASE_URL ? { datasource: { url: process.env.DATABASE_URL } } : {}),
});
