# Changelog

All notable changes to this project. Format based on Keep a Changelog.

## [Unreleased]

### Added — Payment module, SSLCOMMERZ ready but switched off (2026-11-04)

- `payments` and `payment_events` tables (additive migration
  `20261105090000_payments`, CHECK amount > 0).
- `PaymentProvider` port with an SSLCOMMERZ v4 adapter (session, validation,
  lookup by `tran_id`, callback signature) and a development-only simulator.
  `PAYMENT_PROVIDER=none` by default; live mode needs explicit approval (ADR-0022).
- API: `POST /me/bookings/{id}/payment-session`, SSLCOMMERZ IPN and return
  endpoints, `GET /admin/payments`; booking detail gains `payments` and `canPay`.
- Verified payments confirm bookings through the state machine and turn held
  inventory into sold; mismatches go to manual review; late payments are
  flagged `REFUND_REQUIRED`; the hold sweeper reconciles before expiring.
- Web: working "Pay now" when payments are enabled, payment result banner,
  payment history. Admin: Payments page and payments on booking detail.
- Tests: 9 adapter unit tests, config guards, a contract-convention guard, and
  7 MySQL integration tests for the full payment flow.
- `docs/operations/SSLCOMMERZ_INTEGRATION.md`: step-by-step switch-on guide
  and sandbox checklist.

### Added — Phase 4 booking engine and customer flow (2026-11-04)

- API: `POST /bookings` (hotel and tour) with an inventory hold, `Idempotency-Key`,
  row locks, server-side price revalidation (`409 price-changed`) and
  `409 not-available`; `GET /quotes/hotel`, `GET /quotes/tour`;
  `GET /hotels/{slug}/offers`; `POST /me/bookings/{id}/cancel`; hold-expiry
  sweeper; holds released on expiry, cancellation or failure (ADR-0018).
- Booking detail now carries the price breakdown, items, travellers, contact
  and hold expiry.
- Web: stay results, property page with priced rooms, tour list with a
  departure picker, checkout with traveller details, sign in / create account,
  and My trips with a live hold countdown and cancel. The homepage search now
  opens real results.
- Demo catalog seed for the pre-launch server, removable in one command (ADR-0021).

### Added — Phase 3 completion (2026-11-04)

- Admin: staff sign-in screen; every console page needs a staff session. The
  dashboard, bookings list (server filters, keyset pages), booking detail with
  an audited status-change form, Staff and roles, and Audit log all use live
  API data. The sample data file is gone.
- API: `GET /admin/dashboard`, `GET/POST /admin/staff`, `PATCH /admin/staff/{id}`
  (only owners grant the owner role, no self-demotion, last-owner protection,
  disabling revokes sessions), `GET /admin/audit`.
- `packages/api-client` generated from the OpenAPI document (ADR-0020); shared
  accessible form fields and a Zod resolver in `packages/ui`.
- Tests: 9 MySQL 8.4 integration tests (concurrent last-room race, idempotent
  replay, price change, cancel/expiry release, CHECK constraint, staff rules)
  plus a CI job that runs them on the official MySQL 8.4.13 tarball (no
  containers); 8 new unit tests.
- HTTPS on :8443 with a self-signed certificate (`infra/server/enable-https.sh`,
  ADR-0019); the deploy agent now waits for both CI jobs.

### Fixed

- CI race: `@pegah/db` build and typecheck both ran `prisma generate` in
  parallel, so a typecheck could read a half-written client. Typecheck now
  reuses the build output and turbo runs it after the build.

- The OpenAPI document described nullable strings as arrays (since Phase 3);
  contracts now use `nullableText()` (ADR-0020).
- The booking detail field `guests` (count) collided with the traveller list;
  the list is now `travellers`.

### Added — Phase 3 backend foundation (2026-11-04)

- `packages/contracts`: Zod schemas for money, problem details, pagination,
  permissions, staff roles, auth, bookings, catalog and health.
- `packages/db`: Prisma 7 schema (22 tables) and initial MySQL migration with
  CHECK constraints against overbooking and inconsistent totals.
- `apps/api` (NestJS 11 + Fastify): health probes; customer and staff auth
  (Argon2id, hashed server-side sessions, HMAC CSRF, Origin allow-list);
  permission guard; catalog, hotel search with server-computed prices, tours;
  customer and admin booking reads; booking state machine with history and
  audit; RFC 9457 errors; Helmet; strict CORS; rate limits; OpenAPI export.
- Operator CLIs: `seed:rbac`, `staff:create`, `seed:sample`.
- 52 new tests (pricing, state machine, availability, dates, config, HTTP).
- CI: OpenAPI drift check. ADR-0013, ADR-0014, ADR-0015.

### Security

- Fastify forced to 5.12.7 (high advisory in 5.11.3 pinned by
  `@nestjs/platform-fastify`); js-yaml 5.4.3 under `@nestjs/swagger`;
  Vitest 4.1.12 (critical tinypool advisory in 3.x); Turborepo 2.11.10.

### Added — Phase 2 code (2026-11-04)

- npm-workspaces + Turborepo monorepo with pinned toolchain (ADR-0011).
- `packages/design-tokens`, `packages/ui`, `packages/shared` (with 17 unit tests).
- `apps/web`: Next.js homepage built from the approved v2 design.
- `apps/admin`: Next.js admin dashboard, bookings list and module placeholders.
- GitHub Actions CI: format, lint, typecheck, unit tests, build.

### Changed

- 2026-11-04 — Primary colour is now `#FF852F` with accessible text variants
  (ADR-0010); caption colour darkened to pass WCAG AA.
- 2026-11-04 — Homepage prototype v2: immersive, booking-first layout with
  hero slideshow, trending carousel, mood mosaic, stay cards and newsletter;
  six new licensed photos (Sundarbans, Boga Lake, Kaptai, Nafakhum, Panam
  City, Lawachara, Saint Martin's); two unused photos removed.

### Added

- 2026-11-04 — Phase 1 documentation: `CLAUDE.md`, product requirements,
  system architecture, ADR-0001…0009, database design, API conventions,
  security model, test strategy, deployment, backup/recovery, runbook,
  project status and feature matrix.
- 2026-11-04 — Kantha design system draft and static homepage prototype with
  licensed Wikimedia Commons photography and image credits.
- 2026-11-04 — Repository hygiene: `.gitignore`, `.gitattributes`,
  `.editorconfig`, pull request template with change-impact checklist.
