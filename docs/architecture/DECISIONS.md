# Architecture Decision Records

Format: context → decision → consequences. Status is Accepted, Proposed or Superseded.

## ADR-0001 — Modular monolith in an npm-workspaces monorepo

- **Status:** Accepted (2026-11-04)
- **Context:** One team, one server, a financial booking domain that needs
  transactional consistency.
- **Decision:** Single NestJS API with strict modules, plus web, admin and worker
  apps, in npm workspaces with Turborepo. No microservices.
- **Consequences:** Simple deploys and transactions; module boundaries must be
  enforced by convention and lint rules.

## ADR-0002 — Zod contracts as the single API source of truth

- **Status:** Accepted (2026-11-04)
- **Decision:** `packages/contracts` holds Zod schemas used by forms, API pipes
  (`nestjs-zod`) and the OpenAPI document; `packages/api-client` is generated.
- **Consequences:** class-validator is not used. CI checks for client drift.

## ADR-0003 — Separate admin application

- **Status:** Accepted (2026-11-04)
- **Decision:** Admin is its own Next.js app on its own origin and cookie.
- **Consequences:** Public-site XSS cannot reach staff sessions; shared UI via `packages/ui`.

## ADR-0004 — Money as integer minor units

- **Status:** Accepted (2026-11-04)
- **Decision:** `BIGINT` minor units + `CHAR(3)` ISO 4217 currency on every money
  column; totals computed server-side and snapshotted at hold time.

## ADR-0005 — First vertical slice: direct hotels and tours

- **Status:** Accepted (2026-11-04)
- **Decision:** Build the booking engine end-to-end on Pegah-contracted hotel and
  tour inventory. Flights wait for a supplier contract.

## ADR-0006 — SSLCOMMERZ as first sandbox payment gateway

- **Status:** Accepted (2026-11-04), sandbox only
- **Decision:** Hosted checkout via SSLCOMMERZ sandbox (cards, bKash, Nagad through one
  integration). A gateway adapter interface keeps other providers pluggable.
- **Consequences:** Production use requires a merchant agreement.

## ADR-0007 — Design direction "Kantha"

- **Status:** Accepted (2026-11-04)
- **Decision:** Indigo/madder palette, Bodoni Moda + Hanken Grotesk, the running
  stitch as the system motif; map-forward browsing borrowed for tours.
- **Consequences:** See `docs/design/DESIGN_SYSTEM.md`.

## ADR-0008 — Redis or Valkey depending on RHEL release

- **Status:** Accepted (2026-11-04)
- **Context:** The server runs Oracle Linux 9.8 (EL9), where Redis 7.2 is the
  distribution package and is already running for another tenant.
- **Decision:** Use the existing Redis 7.2 with a dedicated ACL user for Pegah
  and the `pg:` key prefix. Valkey is reconsidered on an EL10 upgrade
  (protocol-compatible with BullMQ).

## ADR-0009 — Node.js version

- **Status:** Accepted (2026-11-04)
- **Decision:** Node.js 22 LTS — the server already has v22.23.2 and CI uses 22. `.nvmrc` pins 22 and `engines.node` is `>=22.12.0` (also Prisma 7's
  floor). The workstation's Node 26 is fine for development.

## ADR-0010 — Primary colour #FF852F

- **Status:** Accepted (2026-11-04, owner decision); supersedes the madder accent in ADR-0007.
- **Context:** Orange `#FF852F` has 2.43:1 contrast on white, below WCAG AA for text.
- **Decision:** `--pg-primary` is `#FF852F` for fills, stitch lines, badges and
  charts. Filled controls use indigo text (`--pg-on-primary`, 6.07:1). Orange
  text on light surfaces uses `--pg-primary-ink` `#B5520F` (5.03:1 on white,
  4.61:1 on paper); on dark surfaces `#FF852F` / `#FFA365` are used directly.
- **Consequences:** Never put white text on the primary orange.

## ADR-0011 — Frontend toolchain versions

- **Status:** Accepted (2026-11-04)
- **Decision:** Next.js 16.4.5, React 19.2.9,
  TypeScript 5.9.3 (TS 7 skipped until ecosystem support is proven),
  Tailwind CSS 4.1.18, ESLint 9.39 with eslint-config-next 16.4.5 (ESLint 10
  skipped), Radix Tabs 1.1 / Popover 1.1, Vitest 3.2, Turborepo 2.5,
  Prettier 3.6. All pinned exactly in `package.json` and the lockfile.
- **Security override:** 16.3.8 was chosen first for maturity, but `npm audit`
  reported critical advisories for Next.js 16.0.0–16.4.0 (GHSA-2464-fhr4-w9xw
  image-optimisation RCE, GHSA-673q-mjm6-r5xr `use cache` RCE,
  GHSA-p3m5-59mp-jv5r Server Actions DoS). Upgraded to the patched 16.4.5 the
  same day. Rule: a security fix outranks the "let releases age" preference.

## ADR-0012 — Shared presentation utilities package

- **Status:** Accepted (2026-11-04)
- **Decision:** `packages/shared` holds pure, tested presentation helpers
  (money formatting, Asia/Dhaka calendar, six seasons). It contains no
  pricing or booking rules; those stay in `apps/api` (ADR-0001).

## ADR-0013 — API toolchain: NestJS 11 on Fastify with nestjs-zod

- **Status:** Accepted (2026-11-04)
- **Decision:** NestJS 11.2.7 + `@nestjs/platform-fastify` 11.2.7,
  `@nestjs/swagger` 11.4.7, `nestjs-zod` 5.5.0, Zod 4.6.7, `@nestjs/throttler`
  6.7.1, `@fastify/cookie` 11.1.3, `@fastify/helmet` 13.2.0, argon2 0.45.1.
- **Why not NestJS 12:** `nestjs-zod` (mandated in `CLAUDE.md`) declares peer
  support only up to NestJS 11. Revisit when it supports 12.
- **Security overrides:** `@nestjs/platform-fastify` 11.2.7 pins Fastify
  5.11.3, which has a high advisory (schema validation bypass, X-Forwarded
  spoofing under trustProxy, fixed in 5.12.1). The root `overrides` force
  Fastify 5.12.7. `js-yaml` under `@nestjs/swagger` is overridden to 5.4.3.
- **No Swagger UI:** `@fastify/static` (and its vulnerable `glob`) is not
  installed; the OpenAPI JSON is served at `/api/v1/docs/openapi.json` outside
  production and committed as `apps/api/openapi.json`.
- **Build:** `tsc` (decorator metadata) for the API; Vitest uses SWC for the
  same reason. Vitest upgraded 3.2 → 4.1.12 and Turborepo 2.5 → 2.11.10 to
  clear critical/moderate dev-tool advisories.
- **Accepted residual risk:** `deepmerge` 4.3.1 (low, no patched release) via
  `nestjs-zod`, used only while building the OpenAPI document; dev-only
  `minimatch` advisories via ESLint 9.
- **Quirk:** top-level request/response schemas must not carry
  `.meta({ id })` (nestjs-zod 5 then emits duplicate component names); only
  nested, reused schemas get ids.

## ADR-0014 — Prisma 7 with the MariaDB driver adapter

- **Status:** Accepted (2026-11-04)
- **Decision:** Prisma 7.10.1 with the `prisma-client` generator (CommonJS
  output into `packages/db/src/generated`, gitignored) and
  `@prisma/adapter-mariadb`, which speaks the MySQL 8.4 protocol. Prisma 7
  requires a driver adapter; there is no MySQL-specific one.
- **Migrations:** the initial migration was generated offline with
  `prisma migrate diff --from-empty` and extended by hand with CHECK
  constraints (`held + sold <= total`, booking total = parts). Production
  applies migrations with `prisma migrate deploy` only.
- **Collation:** Prisma emits `utf8mb4_unicode_ci`; we keep it for every
  table so future generated migrations stay consistent.

## ADR-0015 — Session, CSRF and RBAC design

- **Status:** Accepted (2026-11-04)
- **Sessions:** 256-bit random token in an HttpOnly, SameSite=Lax cookie
  (`__Host-` prefixed and Secure when `COOKIE_SECURE=true`); only its SHA-256
  is stored. Separate cookies and session kinds for customers (`pg_sid`,
  14 days absolute / 3 days idle) and staff (`pg_staff_sid`, 12 h / 30 min).
- **CSRF:** token = HMAC-SHA256(`SESSION_SECRET`, session token hash),
  returned by login and `GET /auth/session`, required in `X-CSRF-Token` on
  every cookie-authenticated mutation. Plus an Origin allow-list on all
  state-changing requests.
- **RBAC:** permission keys live in `packages/contracts`; default role grants
  live in `apps/api/src/rbac/role-defaults.ts` and are written by
  `seed:rbac`. One global guard checks origin → session → CSRF → permissions.
- **Accepted for now:** registration answers 409 for an existing email
  (enumeration) until email verification exists; rate limits are in-memory
  per process until Redis arrives (ADR-0008).

## ADR-0016 — Pull-based continuous deployment on a shared server

- **Status:** Accepted (2026-11-04)
- **Context:** The production host (Oracle Linux 9.8) is shared with another
  project, sits on a private network, and the repository is public. A
  self-hosted GitHub runner would expose the server to fork pull requests.
- **Decision:** A systemd timer on the server (`pegah-deploy-agent`) polls for
  `v*` tags and deploys a tag only after GitHub CI for that commit succeeded.
  Pushing the tag is the manual production approval. Releases are atomic
  symlink switches with automatic rollback on failed health checks.
- **Isolation from the other tenant:** own ports (3100/3101/4100, public
  :8180), own nginx site file, own MySQL server and users, own Unix user with
  sudo limited to restarting Pegah units. Redis is not used until Phase 4.
- **Revisit:** if the repository becomes private, a runner with a protected
  `production` environment is an alternative.

## ADR-0017 — Every CI-green push to `main` deploys to production

- **Status:** Accepted (2026-11-04), amends ADR-0016
- **Context:** The owner asked to see the effect of each push on the server
  directly ("push er impact ami visually server theke dekte pari").
- **Decision:** The deploy agent deploys the head of `main` as soon as the CI
  job for that exact commit succeeds. The owner authorised this automatic
  deployment on 2026-11-04; pushing to `main` (which Claude does only with the
  owner's approval) is the production approval. `v*` tags remain release
  markers and can be deployed manually with `deploy.sh vX.Y.Z`.
- **Visibility:** every build carries its commit: web footer and admin
  sidebar show `Build <sha> · <time Dhaka>`, and `/api/v1/health/live` returns
  `commit` and `builtAt`. History in `/opt/pegah/shared/state/deploy-history`.
- **Safety kept:** CI must pass; failed health checks roll back; failed
  commits are never retried; migrations must be backward compatible.
- **Revisit:** add a separate staging instance before real customers arrive,
  so `develop` deploys to staging and production returns to explicit releases.
