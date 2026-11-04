# Test Strategy

Status: **partly implemented.** 69 Vitest tests: `packages/shared` (17),
API pure logic (pricing, state machine, hotel availability, Dhaka dates,
config) and HTTP-level tests that boot the real Nest/Fastify app against an
in-memory database fake (`apps/api/src/test`). CI has no database because
containers are not allowed; integration tests against real MySQL 8.4 run
locally/on staging once a database is available (see PROJECT_STATUS).

| Level         | Tool                                  | Scope                                                                                                          | When                                 |
| ------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Static        | ESLint, Prettier, `tsc --noEmit`      | All workspaces                                                                                                 | Pre-commit (changed files), every PR |
| Unit          | Vitest                                | Pricing, tax, discounts, booking state transitions, permission checks, contracts                               | Every PR                             |
| Integration   | Vitest + real MySQL 8.4 + Redis on CI | Auth, inventory holds under concurrency, idempotent booking, webhook replay, refunds, cache invalidation, jobs | Every PR                             |
| End-to-end    | Playwright                            | Search → book → sandbox pay → voucher; account; admin refund                                                   | PRs to `develop`, nightly            |
| Accessibility | axe-core in Playwright                | Every page template, WCAG 2.2 AA                                                                               | With E2E                             |
| Performance   | Lighthouse CI, bundle budgets, k6     | CWV lab budgets; API p95 latency                                                                               | PRs (Lighthouse), pre-release (k6)   |
| Security      | npm audit, CodeQL, gitleaks           | Dependencies, code, secrets                                                                                    | Every PR                             |
| Recovery      | Restore drill script                  | Backup restores into restore-staging with checksum and row-count checks                                        | Weekly on server, once approved      |

## Must-have scenarios

1. N parallel holds on the last room → exactly one succeeds.
2. A payment webhook replayed 10 times → one payment record, one state change.
3. Hold expiry releases inventory exactly once.
4. Client-sent totals are ignored; server total wins.
5. A customer cannot read another customer's booking (404, not 403).

## Reporting rule

Only report a check as passing if it was executed. If a check cannot run, record
why in `docs/PROJECT_STATUS.md`.

## Database integration tests (Phase 3/4)

`apps/api/src/test/booking.int.test.ts` runs against a real MySQL 8.4 server
when `PEGAH_IT_DATABASE_URL` points at a user that may create `pegah_it_*`
databases. Each run creates a fresh database, applies the real migrations,
and drops it afterwards. CI starts Oracle's MySQL 8.4.13 tarball as a plain
process (job "Database integration (MySQL 8.4)"; no containers). Covered: the
concurrent last-room race, idempotent replay and key reuse, price change,
party validation, hold release on cancel and expiry, the CHECK constraint,
the dashboard, staff-management rules and the audit log.
