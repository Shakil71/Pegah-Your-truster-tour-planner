# Pegah Travel Platform

Pegah is a travel booking platform for Bangladesh: hotels, tours, flights and
visa services, priced in BDT, with an architecture ready for international
expansion.

> **Status:** Phase 3. The homepage and admin dashboard (sample data) are
> built in Next.js; the API, contracts and database schema exist and are
> tested against an in-memory fake, but have not yet run against MySQL. No
> payment integration yet. See [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md).

## Repository layout

| Path                                             | Contents                                                                               |
| ------------------------------------------------ | -------------------------------------------------------------------------------------- |
| [apps/web](apps/web)                             | Customer site (Next.js App Router), port 3000                                          |
| [apps/admin](apps/admin)                         | Staff back office (Next.js), port 3001                                                 |
| [apps/api](apps/api)                             | REST API (NestJS + Fastify), port 4000, `/api/v1`                                      |
| [packages/contracts](packages/contracts)         | Zod request/response contracts (single source of API shapes)                           |
| [packages/db](packages/db)                       | Prisma schema, migrations and client factory (API and worker only)                     |
| [packages/design-tokens](packages/design-tokens) | Kantha tokens: CSS variables, Tailwind v4 theme, TS values                             |
| [packages/ui](packages/ui)                       | Shared components: icons, logo, stitch, button styles                                  |
| [packages/shared](packages/shared)               | Tested presentation utilities: money, Asia/Dhaka dates, six seasons                    |
| [docs](docs)                                     | Requirements, architecture, ADRs, database, API, design, security, testing, operations |
| [CLAUDE.md](CLAUDE.md)                           | Engineering rules for Claude Code and contributors                                     |

## Run locally

Requires Node.js ≥ 20.9 (CI uses 22).

```bash
npm ci
npm run dev:web     # http://localhost:3000
npm run dev:admin   # http://localhost:3001
```

The API needs MySQL 8.4. Copy `apps/api/.env.example` to `apps/api/.env`,
fill in `DATABASE_URL` and `SESSION_SECRET`, then:

```bash
npm run build -w @pegah/contracts -w @pegah/db
DATABASE_URL=... npm run migrate:deploy -w @pegah/db
npm run build -w @pegah/api
DATABASE_URL=... npm run seed:rbac -w @pegah/api
DATABASE_URL=... npm run seed:sample -w @pegah/api   # development only
npm run dev -w @pegah/api                             # http://localhost:4000/api/v1
```

## Checks

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

The same checks run in GitHub Actions on every push to `main`/`develop` and on
pull requests.

## Stack

Next.js 16 · React 19 · TypeScript 5.9 (strict) · Tailwind CSS 4 · Radix UI ·
NestJS 11 (Fastify) · Zod 4 · Prisma 7 + MySQL 8.4 · Vitest · Turborepo.
Planned: Redis + BullMQ, native RHEL with systemd and Nginx. No containers.
Details: [docs/architecture/SYSTEM_ARCHITECTURE.md](docs/architecture/SYSTEM_ARCHITECTURE.md).

## Contributing

Read [CLAUDE.md](CLAUDE.md) first. Branch from `develop` as `feature/<name>`,
use Conventional Commits, and fill in the change-impact checklist in the pull
request template.

## License

Proprietary. All rights reserved. Destination photographs are third-party works
under their own licences; see [docs/design/IMAGE_CREDITS.md](docs/design/IMAGE_CREDITS.md).
