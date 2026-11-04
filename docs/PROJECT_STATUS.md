# Project Status

_Last updated: 2026-11-04_

## Current phase

**Phase 3 (backend foundation) — implemented, not yet run against a real
database.** `apps/api` (NestJS + Fastify), `packages/contracts` (Zod) and
`packages/db` (Prisma schema + initial migration) exist with auth, RBAC,
catalog reads, hotel search with server-side pricing, the booking state
machine and audit logging. All checks pass with an in-memory database fake;
the MySQL integration run is blocked on a local database (see Blockers).

## Completed

- Phase 1: repository audit, environment assessment, approved proposal,
  `CLAUDE.md`, full documentation set, ADR-0001 … ADR-0007.
- Phase 2: monorepo, design tokens (primary `#FF852F`, ADR-0010), `packages/ui`,
  `packages/shared`, `apps/web` homepage, `apps/admin` dashboard with sample
  data, GitHub Actions CI.
- Phase 3:
  - `packages/contracts`: money, problem details, pagination, permissions,
    staff roles, auth, booking, catalog and health schemas (ADR-0002).
  - `packages/db`: Prisma 7 schema for identity, catalog, inventory, rates,
    tours, bookings, holds, status history, idempotency keys, outbox and audit;
    initial migration with CHECK constraints (ADR-0014).
  - `apps/api`: config validation, RFC 9457 errors, Helmet, strict CORS, rate
    limits, health probes, customer and staff auth with Argon2id and
    hashed server-side sessions, HMAC CSRF, permission guard (ADR-0015),
    catalog endpoints, hotel search, customer and admin booking reads,
    state-machine status changes with history and audit in one transaction,
    OpenAPI export.
  - Operator CLIs: `seed:rbac`, `staff:create` (hidden password prompt),
    `seed:sample` (refuses production).
  - CI: OpenAPI drift check added.
  - Security upgrades: Fastify 5.12.7 override, js-yaml override, Vitest
    4.1.12, Turborepo 2.11.10 (ADR-0013).

## In progress

- Phase 2 design for remaining pages: search results, property page, tour
  page, checkout, account.

## Next recommended actions

1. Owner approves a local MySQL 8.4 for development (portable ZIP already
   downloaded and checksum-verified, or WSL), then: apply the migration, run
   `seed:rbac` and `seed:sample`, and run the API against it.
2. Add DB integration tests (concurrent holds, CHECK constraints, ownership).
3. Admin app: staff login screen and switch the dashboard/bookings pages from
   sample data to the API (`packages/api-client` generated from
   `apps/api/openapi.json`).
4. Phase 4: booking creation with inventory holds and idempotency keys.
5. Owner runs the read-only server inspection (ADR-0008/0009).

## Blockers

| Blocker                           | Blocks                                        | Owner                                |
| --------------------------------- | --------------------------------------------- | ------------------------------------ |
| No local MySQL / Redis            | DB integration tests, running the API locally | Owner: approve portable MySQL or WSL |
| RHEL version unknown              | Node/MySQL/Redis version lock (ADR-0008/0009) | Owner: run inspection                |
| Root password exposed in chat     | Server security                               | Owner: rotate, disable root SSH      |
| No flight supplier contract       | Flights                                       | Owner                                |
| No SSLCOMMERZ sandbox credentials | Payment integration (Phase 5)                 | Owner                                |
| Domain not chosen                 | TLS, email DNS, production cookie origin      | Owner                                |

## Known issues

- Node.js is installed at `C:\Program Files\nodejs` but VS Code's terminal
  PATH does not include it until VS Code is restarted.
- Node 26 prints a `module.register` deprecation warning during `next build`;
  harmless, and CI uses Node 22.
- Admin app still shows sample data and has no login screen; it must not be
  exposed publicly. The API's staff auth is ready for it.
- Rate limits are in-memory per process until Redis is available.
- Registration reveals whether an email is registered (409) until email
  verification exists (ADR-0015).
- `npm audit --omit=dev`: 2 low (`deepmerge` via `nestjs-zod`, no fix
  released). Dev-only: moderate `minimatch` advisories via ESLint 9.
- npm 11 holds back install scripts (esbuild, @swc/core, argon2, prisma);
  everything used works with the shipped prebuilt binaries.
- Repository name contains the typo "truster".

## Latest validation results (2026-11-04, local, Node 26.13)

| Check                                      | Result                                                                                                              |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `vitest run`                               | 69/69 passed (shared 17; API unit 31; API HTTP-level 21 against an in-memory DB fake)                               |
| `turbo run lint typecheck build`           | 15/15 tasks passed (web, admin, api, contracts, db, ui, shared, tokens)                                             |
| Prettier `--check .`                       | Passed                                                                                                              |
| `prisma generate` / offline `migrate diff` | Passed; 22 tables, 25 foreign keys                                                                                  |
| OpenAPI export                             | 20 paths written to `apps/api/openapi.json`                                                                         |
| API HTTP smoke test (compiled, no DB)      | live 200; ready 503 in 2.0 s; catalog 503 problem; protected routes 401; foreign Origin 403; Helmet headers present |
| Migration applied to MySQL 8.4             | **Not run** — no local database; running a downloaded MySQL binary needs owner approval                             |
| DB integration tests                       | **Not written yet** — need a database                                                                               |
| axe / Lighthouse / Playwright              | Not run yet — no browser automation set up                                                                          |
| GitHub Actions CI                          | Runs on push                                                                                                        |

## Approvals required

- Local MySQL 8.4 for development (portable, scratchpad, 127.0.0.1 only) or WSL.
- Feedback on the running homepage and admin dashboard.
- Read-only server inspection (owner runs it, or approves non-root SSH key).
