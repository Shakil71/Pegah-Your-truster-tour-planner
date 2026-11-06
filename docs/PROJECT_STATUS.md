# Project Status

_Last updated: 2026-11-06_

## Current phase

**Phases 1–7 and the cross-cutting work are built, tested and deployed** to
the pre-launch server: catalog, search, holds and bookings, payments
(simulator verified; SSLCOMMERZ waits for credentials), cancellations and
refunds, console control, media library, home editor, partner portals,
offers, ads, orders, gift cards (including paying for bookings), email
verification, Bangla website, emails and partner portal, light and dark
themes, worker, Redis and monitoring. Phase 8 (third-party supply) waits for
supplier contracts.

## Completed

- Offers, ads, orders and gift cards with purchase-alert emails (ADR-0032);
  light/dark theme toggle (ADR-0033); gift cards at checkout (ADR-0034);
  refunds back to gift cards (ADR-0037).
  Email verification at sign-up (ADR-0035); Bangla emails (ADR-0036) and
  Bangla partner portal (ADR-0028 extended).

- Console control: editable settings with encrypted credentials, customer
  account controls, media library, home page editor (ADR-0029 … ADR-0031).

- Bangla customer website (ADR-0028).

- Cross-cutting: worker process, Redis rate limits, metrics and monitoring
  setup (ADR-0027). Owner action: run the two setup scripts
  (`docs/operations/MONITORING.md`).

- Cross-cutting: Playwright end-to-end + axe accessibility suite in CI.

- Phase 7: partner portals: supplier inventory and reservations, agent
  booking with commission and statements, admin partner management (ADR-0026).

- Phase 6 completion: promotions, sales reports + CSV, content pages (ADR-0025).

- Phase 5 completion: cancellations and refunds, email outbox (off until SMTP),
  password reset/change, profile, saved travellers, vouchers (ADR-0024).

- Phase 6 (core): catalog, inventory calendar, tours/departures, customers,
  and cross-module links in admin and web (ADR-0023). Remaining Phase 6 items
  (promotions, reports, content) are tracked in `docs/ROADMAP.md`.

- Phase 1: audit, environment assessment, approved proposal, `CLAUDE.md`,
  documentation set, ADR-0001 … ADR-0007.
- Phase 2: monorepo, design tokens (`#FF852F`, ADR-0010), `packages/ui`,
  `packages/shared`, homepage, admin design, CI.
- Phase 3 (backend foundation and admin connection):
  - Contracts, Prisma schema and migration, NestJS API with auth, RBAC, CSRF,
    catalog, search, booking state machine, audit (ADR-0013 … ADR-0015).
  - Admin: staff sign-in; dashboard, bookings list, booking detail with an
    audited status change, Staff and roles, Audit log, all on live data.
  - API: dashboard summary, staff management (owner-only owner grants,
    last-owner protection, disable revokes sessions), audit log read.
  - `packages/api-client` generated from OpenAPI (ADR-0020).
  - MySQL 8.4 integration tests, local and in CI (no containers).
- Phase 4 (booking engine and customer flow):
  - `POST /bookings` with holds, `Idempotency-Key`, row locks, price
    revalidation; quotes; hotel offers; customer cancel; hold expiry (ADR-0018).
  - Web: stay results, property page, tours, departure picker, checkout,
    sign in / create account, My trips with hold countdown and cancel.
  - Demo catalog seed, labelled and removable (ADR-0021).
- Phase 5 foundation: payments/payment_events tables, provider port,
  SSLCOMMERZ adapter (unverified, off), simulator, server-side verification,
  confirmation with hold conversion, refund-required flagging, reconciliation,
  Pay now / Payments UI (ADR-0022).
- Infra: pull-based CD from `main` (ADR-0016/0017); HTTPS script for :8443
  (ADR-0019); the deploy agent requires both CI jobs to pass.

## Next recommended actions

All software phases that do not depend on outside parties are built,
tested and deployed. What remains is configuration by the owner and items
that need a contract or a second server.

**Owner configuration (one session, with Claude's help):**

1. Rotate `SETTINGS_ENCRYPTION_KEY` **before the first gift card is sold**
   (after that, rotating breaks resending existing codes). The key is set on
   the server only; never paste it in chat.
2. Email (SMTP) in Console → Settings → Email. Until then customer emails and
   purchase alerts to pegah.com.bd@gmail.com are recorded as SKIPPED.
3. After SMTP works: decide whether to switch on "Customers must confirm their
   email" (Settings → Booking rules).
4. SSLCOMMERZ sandbox credentials → sandbox checklist
   (`docs/operations/SSLCOMMERZ_INTEGRATION.md`) → live approval.
5. Change the owner's console password; create personal staff accounts.

**Before real customers:** remove demo data (`seed-sample.js --demo
--remove`), choose a domain and trusted certificate, add a staging instance,
run a backup restore drill.

**Later improvements:** alert notifications (need a destination), Loki
(needs a second server), agent net rates (when a contract needs them).

## Blockers

| Blocker                              | Blocks                                        | Owner          |
| ------------------------------------ | --------------------------------------------- | -------------- |
| No SMTP account                      | All customer emails, purchase alerts          | Owner          |
| No SSLCOMMERZ credentials            | Online payment (offline "Mark as paid" works) | Owner          |
| Domain not chosen                    | Trusted TLS, email DNS, cookie origin         | Owner          |
| No flight / bedbank contract         | Flights, third-party hotels                   | Owner          |
| Secure document storage not designed | Visa services                                 | Owner + Claude |

## Known issues

- The server certificate is self-signed: browsers warn once per device.
- Demo listings are on the pre-launch server by owner approval (ADR-0021).
- Registration answers 409 for an existing email (ADR-0035 notes the fix).
- `npm audit --omit=dev`: 2 low (`deepmerge` via `nestjs-zod`).
- Node 26 prints a `module.register` deprecation warning locally; CI uses 22.
- Repository name contains the typo "truster".

## Latest validation results (2026-11-06, local and CI)

| Check                       | Result                                                           |
| --------------------------- | ---------------------------------------------------------------- |
| Unit tests (`npm test`)     | 109 passed                                                       |
| MySQL 8.4 integration tests | 101 passed (16 files)                                            |
| `turbo run lint typecheck`  | 13/13 tasks passed                                               |
| Playwright + axe end to end | 33 passed (desktop + mobile, light and dark themes, Bangla)      |
| GitHub Actions              | verify, database integration and end-to-end jobs green on `main` |

## Approvals required

- Owner configuration listed above (SMTP, SSLCOMMERZ, key rotation).
- Before real customers: remove demo data, choose a domain, add staging.
