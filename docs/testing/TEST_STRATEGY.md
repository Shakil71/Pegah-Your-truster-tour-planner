# Test Strategy

Status: **planned**. No tests exist yet because no application code exists.

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
