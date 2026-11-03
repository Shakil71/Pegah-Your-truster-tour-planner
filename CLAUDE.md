# CLAUDE.md — Pegah Travel Platform

Operating rules for Claude Code in this repository. This is a condensed, complete
restatement of the owner's master engineering directive. When in doubt, the
stricter rule wins.

## Start of every session

1. Read this file, `docs/PROJECT_STATUS.md`, `docs/FEATURE_MATRIX.md`,
   and `docs/architecture/DECISIONS.md`.
2. Run `git status`, `git branch`, `git log --oneline -10`. Never overwrite
   uncommitted work.
3. Identify the highest-priority unblocked task in `PROJECT_STATUS.md`.
4. Do not rely on conversation memory; the repository is the source of truth.

## Communication

- Talk to the owner in clear Bangla, using English technical terms where useful.
- Code, identifiers, API definitions and technical docs are in professional English.
- When showing commands, label each as: read-only, local change, Git operation,
  server modification, or destructive.
- Never say a command ran, or a test passed, unless it actually did.

## Hard restrictions (never)

- Docker, Docker Compose, Podman, Kubernetes, or any container deployment.
- Hardcoded credentials, or any root password in scripts, CI, config, docs or code.
- Connecting to the production server (192.168.197.100) without explicit approval.
- Pushing to GitHub, deploying, destructive DB operations, firewall/SELinux
  changes, or restarting server services without explicit approval for that action.
- Force-pushing `main` or `develop`.
- Committing secrets, `.env` files, private keys or database dumps.
- Fake booking confirmations; claiming a ticket/booking is confirmed before the
  authoritative supplier (or Pegah, for direct inventory) has confirmed it.
- Unverified supplier integrations; copied templates, artwork, copy or layouts
  from other travel platforms (GoZayaan, ShareTrip, Booking.com, Expedia, Agoda…).
- Disabling SELinux or firewalld to "make it work".
- Floating-point money. `prisma db push` in production.

## Fixed stack

| Layer       | Choice                                                                                                                                             |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web / admin | Next.js App Router, React, TypeScript strict, Tailwind, Radix UI, Motion (sparingly), React Hook Form, Zod, TanStack Query where needed, next-intl |
| API         | NestJS on Fastify, REST, OpenAPI, Zod validation (`nestjs-zod`), structured logs, RBAC                                                             |
| Data        | MySQL 8.4 LTS, Prisma migrations, InnoDB, utf8mb4                                                                                                  |
| Async       | Redis (or Valkey on RHEL 10), BullMQ, dedicated worker                                                                                             |
| Infra       | Native RHEL, Node.js, systemd, Nginx, SELinux enforcing, firewalld, SSH keys, GitHub Actions                                                       |
| QA          | ESLint, Prettier, tsc, Vitest, Playwright, axe, Lighthouse CI, k6, gitleaks, CodeQL                                                                |
| Monitoring  | Prometheus, Grafana, Loki, health endpoints                                                                                                        |

Verify version compatibility with the actual RHEL release before installing
anything. Never blindly install "latest".

## Architecture rules

- npm workspaces + Turborepo, one `package-lock.json`. Layout in
  `docs/architecture/SYSTEM_ARCHITECTURE.md`. Scaffold only what the current
  phase needs.
- Modular monolith. Business rules live only in `apps/api`. Modules interact
  through exported services, never each other's tables.
- `packages/contracts` (Zod) is the single source for request/response shapes;
  `packages/api-client` is generated from the API's OpenAPI document. Never
  hand-duplicate API types.
- Prisma lives in `packages/db` and is imported only by `api` and `worker`.

## Money, time, booking safety

- Money: `BIGINT` minor units (paisa) + `CHAR(3)` currency. Default BDT.
- Timestamps stored in UTC; display and business cut-offs in Asia/Dhaka.
- Server recomputes every total; frontend totals are never trusted.
- Booking states are changed only through the booking state machine service,
  validated server-side, with history written in the same transaction.
- Idempotency keys for booking creation and payment handling; webhooks verified
  and de-duplicated by provider event id.
- Never hold a DB transaction open across an external API call.
- Revalidate price and availability before final commitment; never confirm from
  cache. Redis is never the source of truth for bookings, payments, refunds,
  balances or inventory.
- Every cache key has a documented format, TTL, invalidation, owner and fallback
  (`docs/architecture/SYSTEM_ARCHITECTURE.md#cache`).

## Security

Argon2id passwords; server-side sessions in HttpOnly, Secure, SameSite cookies;
CSRF protection for cookie-authenticated mutations; backend authorization and
resource-ownership checks on every request; input validation and output
encoding; rate limits; security headers and strict CORS; audit log for sensitive
actions; no raw card data (hosted payment pages only). Never log passwords,
tokens, payment credentials, identity documents or DB secrets.

## Cross-layer synchronization (critical)

Before changing a feature, write a short impact note covering: apps, packages,
tables, API contracts, permissions, cache keys, jobs, tests, docs, backward
compatibility, deployment/migration impact. A feature is not done while any
dependent layer (UI, forms, contracts, controllers, services, authz, schema,
migration, cache, jobs, payments, admin, supplier portal, tests, API docs,
user-facing copy, ops docs) is inconsistent. Use the PR template checklist.

## Definition of done

Requirements met · professional, responsive, accessible UI · backend logic and
authorization · migrations · synced contracts · correct caching · relevant tests
executed and passing · errors and loading states handled · security reviewed ·
docs updated · no known critical regression. Only then mark COMPLETE in
`docs/FEATURE_MATRIX.md` (statuses: NOT_STARTED, PLANNED, IN_PROGRESS, BLOCKED,
TESTING, COMPLETE).

## Task protocol

Understand → analyze → plan → implement → synchronize → validate → review →
document (`PROJECT_STATUS.md`, `FEATURE_MATRIX.md`, `CHANGELOG.md`, affected docs)
→ report (changed, passed, failed, remaining) → request approval for push,
deploy, destructive migration or server change. Routine approved local work
proceeds without repeated questions.

After each feature: format, lint, typecheck, run relevant tests, update docs,
review the diff, scan for secrets, propose a Conventional Commit message.

## Errors

Read the full error, find the root cause, propose the smallest safe fix, apply
it only within authorized scope, re-run the failing check, check for
regressions, document. Never hide errors or weaken security to pass a check.

## Design

Original identity for Pegah only. Approved direction: **Kantha** (see
`docs/design/DESIGN_SYSTEM.md`). Primary colour **#FF852F** (ADR-0010): use
`--pg-on-primary` text on orange fills and `--pg-primary-ink` for orange text
on light surfaces; never white text on orange. The owner prefers immersive,
photo-led, clearly booking-style layouts over quiet editorial ones. All colors, type, spacing, radius, shadow and
motion come from design tokens; no raw hex in components. Photography must be
owned, commissioned or properly licensed with credits recorded in
`docs/design/IMAGE_CREDITS.md`.

## Git

Branches: `main`, `develop`, `feature/*`, `fix/*`, `release/*`, `hotfix/*`.
Conventional Commits. Work on `feature/*` from `develop`. Pushing code never
deploys; production CD needs a protected environment and manual approval.
