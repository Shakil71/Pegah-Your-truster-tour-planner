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

- **Status:** Proposed
- **Context:** RHEL 10 ships Valkey instead of Redis; BullMQ speaks the same protocol.
- **Decision pending:** server RHEL version (see PROJECT_STATUS blockers).

## ADR-0009 — Node.js version

- **Status:** Proposed
- **Decision pending:** newest LTS available on the target RHEL; pin in `.nvmrc` and `engines`.
- **Interim:** `engines.node >=20.9.0` (Next.js minimum). CI uses Node 22. The
  workstation has Node 26, which builds successfully but prints a Node
  deprecation warning from Next.js (`module.register`).

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
