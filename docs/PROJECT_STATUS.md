# Project Status

_Last updated: 2026-11-04_

## Current phase

**Phases 3 and 4 are implemented and verified locally.** The back office runs
on live API data behind staff sign-in. Customers can search stays and tours,
see server-computed prices, sign in, and hold a room or seats for 15 minutes
with an idempotent, lock-protected booking. Payment is Phase 5, so no booking
can become CONFIRMED until a payment provider is switched on.

**Payment module (Phase 5 foundation) is built and switched off.** SSLCOMMERZ
is implemented behind a provider port and verified with a simulator end to
end; it needs sandbox credentials and the checklist in
`docs/operations/SSLCOMMERZ_INTEGRATION.md` before use (ADR-0022).

## Completed

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

1. **Owner:** run `sudo bash /home/pegah/pegah-infra/server/enable-https.sh`
   once (HTTPS on :8443; sign-in needs it).
2. **Owner:** create your own staff account on the server
   (`staff:create`, command in DEPLOYMENT.md). The password is typed into a
   hidden prompt and never shared in chat.
3. Switch on SSLCOMMERZ when credentials exist: follow
   `docs/operations/SSLCOMMERZ_INTEGRATION.md` (sandbox checklist first).
   Then: refunds via API, vouchers and confirmation email.
4. Move the hold sweeper and outbox to `apps/worker` once Redis/Valkey exists
   for Pegah (ADR-0018).
5. Browser automation: Playwright + axe in CI for the booking flow.
6. Before launch: `seed-sample.js --demo --remove`, real domain + certificate,
   staging instance (ADR-0017).

## Blockers

| Blocker                           | Blocks                                 | Owner                                |
| --------------------------------- | -------------------------------------- | ------------------------------------ |
| HTTPS script not run yet          | Sign-in on the server (Secure cookies) | Owner: run `enable-https.sh` as root |
| No Redis/Valkey for Pegah         | Worker, distributed rate limits        | Owner: approve a Pegah-only Valkey   |
| Root password exposed in chat     | Server security                        | Owner: rotate, `PermitRootLogin no`  |
| `pegah` password shared in chat   | Server security                        | Owner: `passwd -l pegah` (keys only) |
| No SSLCOMMERZ sandbox credentials | Payments (Phase 5)                     | Owner                                |
| No flight supplier contract       | Flights                                | Owner                                |
| Domain not chosen                 | Trusted TLS, email DNS, cookie origin  | Owner                                |

## Known issues

- The server certificate is self-signed: browsers warn once per device.
- Demo listings are on the pre-launch server by owner approval (ADR-0021).
- Listing photos are licensed stock matched by destination until the media
  pipeline exists (no uploads yet).
- Rate limits are in-memory per API process until Redis exists.
- Registration reveals whether an email exists (409) until email verification.
- `npm audit --omit=dev`: 2 low (`deepmerge` via `nestjs-zod`).
- Node 26 prints a `module.register` deprecation warning locally; CI uses 22.
- Repository name contains the typo "truster".

## Latest validation results (2026-11-04, local, Node 26.13)

| Check                                   | Result                                                                                                                                                                                               |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test` (unit + HTTP on fake DB)     | 77 passed (integration suite skipped without a DB URL)                                                                                                                                               |
| MySQL 8.4.13 integration tests          | 9/9 passed: last-room race (one 201, one 409), idempotent replay/reuse/missing key, price change, party validation, cancel and expiry release holds, CHECK constraint, dashboard, staff rules, audit |
| `turbo run lint typecheck`              | 13/13 tasks passed                                                                                                                                                                                   |
| `turbo run build`                       | Passed (web, admin, api, packages)                                                                                                                                                                   |
| Prettier `--check`                      | Passed                                                                                                                                                                                               |
| OpenAPI export                          | 29 paths; nullable fields now correct                                                                                                                                                                |
| End-to-end smoke (web origin, real API) | 22/22: pages, sign-in gate, register, results, property, checkout, hold, replay, My trips (never "Confirmed"), cancel, staff login, all admin pages, dashboard shows the booking                     |
| axe / Lighthouse / Playwright           | Not run yet                                                                                                                                                                                          |
| GitHub Actions                          | Pending this push                                                                                                                                                                                    |

## Approvals required

- Run `enable-https.sh` on the server (root).
- Before real customers: remove demo data, choose a domain, add staging.
