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

## ADR-0018 — Booking holds, idempotency and in-API hold expiry

- **Status:** Accepted (2026-11-04)
- **Context:** Phase 4 needs booking creation that never oversells and never
  double-books on retry. Redis/BullMQ (the planned worker) is not available:
  there is no local Redis, and the server's Redis belongs to another tenant.
- **Decision:**
  - `POST /bookings` requires a customer session, CSRF and an
    `Idempotency-Key`. Keys are stored in `idempotency_keys` (24 h); a retry
    with the same body replays the stored response, a different body is 422,
    a concurrent duplicate is 409; failed attempts free the key.
  - One transaction: `SELECT … FOR UPDATE` on the inventory rows (date order)
    or the departure row → re-read rates → recompute the price → compare with
    `expectedTotal` (409 `price-changed`) → increment `held` → write booking,
    items, guests, holds, two history rows, an outbox event and an audit event.
    MySQL CHECK constraints are the last line of defence.
  - Bookings end in `PENDING_PAYMENT` with `holdExpiresAt`
    (`BOOKING_HOLD_MINUTES`, default 15). Nothing reaches `CONFIRMED` without
    payment (Phase 5) or staff review.
  - Expiry, customer cancellation and staff cancel/fail all go through
    `BookingStatusService`, which releases holds in the same transaction.
  - Until the worker exists, a sweeper inside the API process expires due
    holds every `HOLD_SWEEP_SECONDS` (60). Each expiry is a compare-and-set,
    so several API instances are safe.
- **Revisit:** move the sweeper and outbox processing to `apps/worker` when
  Redis/Valkey is provisioned for Pegah.

## ADR-0019 — Self-signed HTTPS on :8443 until a domain exists

- **Status:** Accepted (2026-11-04, owner chose this option)
- **Context:** Session cookies are `Secure` with the `__Host-` prefix, so
  browsers drop them over plain HTTP and nobody could sign in on the server.
  No domain exists yet, so no publicly trusted certificate can be issued.
- **Decision:** `infra/server/enable-https.sh` (run once by the owner as root)
  creates a self-signed certificate for the server IPs, serves the site on
  `https://<ip>:8443`, redirects `:8180` to it, labels the ports
  `http_port_t` and opens them in firewalld. `APP_ORIGINS` lists only the
  HTTPS origins. No HSTS while the certificate is self-signed. Security
  settings were not weakened.
- **Consequence:** browsers warn once per device; users should compare the
  certificate fingerprint printed by the script.
- **Revisit:** when a domain is chosen: real certificate, port 443, HSTS.

## ADR-0020 — Generated API client; nullable text helper

- **Status:** Accepted (2026-11-04)
- **Decision:** `packages/api-client` holds types generated by
  `openapi-typescript` 7.13.0 from `apps/api/openapi.json` plus a thin
  `openapi-fetch` 0.17.0 wrapper. Web and admin call the API only through it.
  CI regenerates both the OpenAPI document and the client and fails on drift.
- **Found while doing this:** a bare `z.string().nullable()` is emitted as
  `type: ["string", "null"]`, which `@nestjs/swagger` mis-reads as an array.
  The OpenAPI document had been wrong since Phase 3. Contracts now use
  `nullableText()` (a bounded string), which generates a correct `anyOf`.

## ADR-0021 — Labelled demo catalog on the pre-launch server

- **Status:** Accepted (2026-11-04, owner approved)
- **Decision:** `seed-sample.js --demo` may run against production before
  launch. Every hotel and tour it creates has "(Demo)" in its name and a
  `demo-` slug, and its description says it is demo data. `--demo --remove`
  deletes the demo listings, their inventory and any bookings made against
  them; real records are never touched.
- **Safety:** payment is not live, so demo bookings stop at `PENDING_PAYMENT`
  and expire; nothing can be confirmed.
- **Revisit:** run `--remove` before launch (tracked in PROJECT_STATUS).

## ADR-0018 — Booking holds, idempotency and in-API hold expiry

- **Status:** Accepted (2026-11-04)
- **Context:** Phase 4 needs booking creation that never oversells and never
  double-books on retry. Redis/BullMQ (the planned worker) is not available:
  there is no local Redis, and the server's Redis belongs to another tenant.
- **Decision:**
  - `POST /bookings` requires a customer session, CSRF and an
    `Idempotency-Key`. Keys are stored in `idempotency_keys` (24 h); a retry
    with the same body replays the stored response, a different body is 422,
    a concurrent duplicate is 409; failed attempts free the key.
  - One transaction: `SELECT … FOR UPDATE` on the inventory rows (date order)
    or the departure row → re-read rates → recompute the price → compare with
    `expectedTotal` (409 `price-changed`) → increment `held` → write booking,
    items, guests, holds, two history rows, an outbox event and an audit event.
    MySQL CHECK constraints are the last line of defence.
  - Bookings end in `PENDING_PAYMENT` with `holdExpiresAt`
    (`BOOKING_HOLD_MINUTES`, default 15). Nothing reaches `CONFIRMED` without
    payment (Phase 5) or staff review.
  - Expiry, customer cancellation and staff cancel/fail all go through
    `BookingStatusService`, which releases holds in the same transaction.
  - Until the worker exists, a sweeper inside the API process expires due
    holds every `HOLD_SWEEP_SECONDS` (60). Each expiry is a compare-and-set,
    so several API instances are safe.
- **Revisit:** move the sweeper and outbox processing to `apps/worker` when
  Redis/Valkey is provisioned for Pegah.

## ADR-0019 — Self-signed HTTPS on :8443 until a domain exists

- **Status:** Accepted (2026-11-04, owner chose this option)
- **Context:** Session cookies are `Secure` with the `__Host-` prefix, so
  browsers drop them over plain HTTP and nobody could sign in on the server.
  No domain exists yet, so no publicly trusted certificate can be issued.
- **Decision:** `infra/server/enable-https.sh` (run once by the owner as root)
  creates a self-signed certificate for the server IPs, serves the site on
  `https://<ip>:8443`, redirects `:8180` to it, labels the ports
  `http_port_t` and opens them in firewalld. `APP_ORIGINS` lists only the
  HTTPS origins. No HSTS while the certificate is self-signed. No security
  setting was weakened.
- **Consequence:** browsers warn once per device; users should compare the
  certificate fingerprint printed by the script.
- **Revisit:** when a domain is chosen: real certificate, port 443, HSTS.

## ADR-0020 — Generated API client; nullable text helper

- **Status:** Accepted (2026-11-04)
- **Decision:** `packages/api-client` holds types generated by
  `openapi-typescript` 7.13.0 from `apps/api/openapi.json` plus a thin
  `openapi-fetch` 0.17.0 wrapper. Web and admin call the API only through it.
  CI regenerates both the OpenAPI document and the client and fails on drift.
- **Found while doing this:** a bare `z.string().nullable()` is emitted as
  `type: ["string", "null"]`, which `@nestjs/swagger` mis-reads as an array.
  The OpenAPI document had been wrong since Phase 3. Contracts now use
  `nullableText()` (a bounded string), which generates a correct `anyOf`.

## ADR-0021 — Labelled demo catalog on the pre-launch server

- **Status:** Accepted (2026-11-04, owner approved)
- **Decision:** `seed-sample.js --demo` may run against production before
  launch. Every hotel and tour it creates has "(Demo)" in its name and a
  `demo-` slug, and its description says it is demo data. `--demo --remove`
  deletes the demo listings, their inventory and any bookings made against
  them; real records are never touched.
- **Safety:** payment is not live, so demo bookings stop at `PENDING_PAYMENT`
  and expire; nothing can be confirmed.
- **Revisit:** run `--remove` before launch (tracked in PROJECT_STATUS).

## ADR-0022 — Payment module with a provider port; SSLCOMMERZ built but switched off

- **Status:** Accepted (2026-11-04)
- **Context:** The owner has no SSLCOMMERZ account yet and wants everything
  ready so it can be switched on later. CLAUDE.md forbids unverified supplier
  integrations in use, fake confirmations, raw card data, and holding a
  transaction across an external call.
- **Decision:**
  - `payments` and `payment_events` tables (additive migration). A
    `PaymentProvider` port with adapters for SSLCOMMERZ (v4 hosted checkout)
    and a simulator. `PAYMENT_PROVIDER=none` is the default everywhere.
  - Every outcome is verified server-to-server (validation API by `val_id`,
    or lookup by `tran_id`) and must match the booking's amount and currency
    in integer paisa. Only then does the state machine move the booking
    `PENDING_PAYMENT → PAYMENT_PROCESSING → CONFIRMED`, converting held
    inventory to sold in the same transaction.
  - Risky or mismatched payments go to `MANUAL_REVIEW`; payments arriving
    after the booking left `PENDING_PAYMENT` become `REFUND_REQUIRED`.
  - The hold sweeper reconciles open payments with the provider before
    expiring a booking. The first payment attempt extends the hold once
    (`PAYMENT_HOLD_EXTENSION_MINUTES`, 20).
  - The simulator is refused when `NODE_ENV=production`; live SSLCOMMERZ is
    refused without `SSLCOMMERZ_LIVE_APPROVED=true`.
- **Verification status:** the SSLCOMMERZ adapter is unit-tested against the
  documented request/response shapes only. It must pass the sandbox checklist
  in `docs/operations/SSLCOMMERZ_INTEGRATION.md` before customers use it.
- **Revisit:** refunds through the API, confirmation emails via the worker.

## ADR-0023 — Back-office catalog and inventory management

- **Status:** Accepted (2026-11-04)
- **Decision:**
  - Staff manage destinations, hotels, room types, the per-night inventory and
    rate calendar, tours and departures through `/api/v1/admin/*`, guarded by
    `catalog:read`, `catalog:manage` and `inventory:manage`; customers are
    readable with `customer:read`.
  - Slugs are fixed at creation, so website links and admin links never break.
  - Inventory edits take the same row locks as booking creation and refuse to
    set rooms on sale below rooms held or sold (`409 below-committed`);
    departures refuse capacity below seats held or sold, and cancellation while
    seats are taken (close first). Past dates cannot be edited.
  - Rate and price changes apply only to new bookings; bookings keep their
    price snapshot.
  - Every change is audited (`catalog.*`, `inventory.*`) with staff and IP.
  - Modules are linked: booking detail carries `customer` and `product`
    (slug, departure); booking lists filter by customer, hotel or tour; hotel
    and tour lists show active bookings; the dashboard links into the catalog.
  - All admin DTO classes are prefixed `Admin…`; a test fails on duplicate DTO
    class names, because Swagger silently merges same-named schemas.
- **Consequence:** public catalog responses are browser-cached (search 30 s,
  pages up to 5 min), so edits appear on the website within that window.

## ADR-0024 — Cancellations, refunds, email outbox, account self-service

- **Status:** Accepted (2026-11-04)
- **Cancellation and refunds:** customers request cancellation of a confirmed
  booking before the start date (`CONFIRMED → CANCELLATION_REQUESTED`). Staff
  approve (`→ CANCELLED`, sold inventory released, optional refund →
  `REFUND_PENDING` + `refunds` row) or reject (`→ CONFIRMED`). The refund is
  capped at what was paid. Finance (`refund:approve`) records the provider or
  bank reference; the booking becomes `REFUNDED` when no refund is pending.
  Money is returned outside Pegah (provider panel) until a refund API is wired.
- **Email:** business transactions write `outbox_events`; a dispatcher in the
  API process (`OUTBOX_POLL_SECONDS`, `FOR UPDATE SKIP LOCKED`, exponential
  retry, max 5 attempts) renders templates and sends them. `EMAIL_TRANSPORT`
  is `none` by default (recorded as SKIPPED), `log` for development, or
  `smtp` (STARTTLS or implicit TLS only). Every message is logged in
  `email_messages` without its body; staff see the log on each booking.
- **Password reset:** single-use token, 30 minutes, only its SHA-256 stored,
  sent directly (never written to the outbox), always `202` so accounts
  cannot be probed; success revokes every session. Password change revokes
  other sessions.
- **Saved travellers:** names, age group, optional date of birth and
  nationality; no identity documents. Offered as suggestions at checkout.
- **Vouchers:** the voucher/invoice page renders only for CONFIRMED or
  COMPLETED bookings.

## ADR-0025 — Promotions, sales reports and content pages

- **Status:** Accepted (2026-11-04)
- **Promotions:** coupon codes (`promotions` table) with percent or fixed
  value, minimum spend, maximum discount, scope (stays / tours / all), time
  window, total and per-customer limits, active/paused. The discount comes off
  the base; service charge and VAT are computed on the discounted base, so the
  booking CHECK becomes `total = base − discount + service charge + VAT`.
  Quotes report why a code does not apply; booking creation re-validates the
  code under a row lock on the promotion, so limits hold under concurrency.
  Redemptions are the bookings referencing the promotion, excluding expired,
  failed and cancelled ones (an unpaid hold that expires gives its use back).
- **Reports:** sales summary (bookings, confirmed value, discounts, refunds
  paid, net revenue, by product/status/day) and a per-booking CSV (UTF-8 BOM,
  formula-injection safe). Dhaka calendar days; max 366 days per report.
- **Content pages:** plain-text pages (blank-line paragraphs, `## ` headings)
  rendered by React as text, never as HTML. Starter drafts for the footer links
  are created on deploy but never published automatically; legal pages need
  the owner's review.
- **Permissions:** `promotion:manage`, `report:read`, `content:manage`
  (owner, admin; operations and finance get reports; content gets content and
  promotions). `seed:rbac` applies them on deploy.

## ADR-0026 — Partner portals: suppliers and travel agents

- **Status:** Accepted (2026-11-04)
- **Model:** one `partners` table with `kind` SUPPLIER or AGENT, status
  ACTIVE/SUSPENDED and `commission_bps` (agents; CHECK at most 50%). Partner users
  are `users` with `kind = PARTNER` and a `partner_id`. They sign in only at
  `/partner/auth/login` (customer and staff sign-in refuse them, and vice versa)
  and get their own cookie (`pg_partner_sid`, staff-length timeouts).
- **Tenancy:** suppliers own hotels and tours through `hotels.partner_id` and
  `tours.partner_id`, assigned by staff. Every partner request resolves the
  partner from the session, and every room, departure or booking id is checked
  against it in the API (unknown or foreign ids return 404). Suppliers change
  only rooms on sale, nightly rates and departure seats/status, through the same
  catalog service, locks and audit as staff (actor type PARTNER).
- **Agents:** `POST /partner/bookings` runs the normal booking engine
  (idempotency, row locks, price revalidation, hold) and stores
  `agent_partner_id` and `commission_minor` = commission rate × total, fixed at
  booking time (CHECK 0 ≤ commission ≤ total). Commission counts as earned only
  for CONFIRMED/COMPLETED bookings; the monthly statement uses Dhaka months. The
  client is the booking contact and receives the emails, without account links;
  after payment the agent returns to `/partner/bookings/{id}`. Agent net rates
  are deferred until an agent contract needs them.
- **Admin:** `partner:manage` (owner, admin) creates partners and their first
  user, edits commission and status (suspending revokes partner sessions at
  once), manages users and assigns hotels and tours. All actions are audited.
- **Payouts** are settled outside the platform for now; the statement is the
  reconciliation record.

## ADR-0027 — Worker process, Redis rate limits and monitoring

- **Status:** Accepted (2026-11-05)
- **Worker:** `pegah-worker` runs the same API codebase from a second
  entrypoint (`apps/api/dist/worker.js`) without an HTTP listener, so business
  rules stay in one place instead of a separate `apps/worker` package. It runs
  the hold sweeper (with payment reconciliation) and the email outbox. The API
  stops running them when `RUN_BACKGROUND_JOBS=false` (set by the setup
  script); until then the API keeps running them, so nothing breaks before the
  owner installs the worker. Both jobs are already safe with several processes
  (state-machine compare-and-set, `SKIP LOCKED`).
- **No BullMQ yet:** the transactional outbox in MySQL is already durable and
  retried. BullMQ is added when a job needs delays or fan-out (PDF rendering).
- **Redis:** the existing Redis 7.2 on the server (RHEL package), not a new
  Valkey install. Pegah gets its own ACL user restricted to `pegah:*` keys and
  the commands it needs. First use: rate limits shared by all processes
  (`pegah:v1:ratelimit:*`, fixed window, one Lua script). If Redis is
  unreachable, limits fall back to the per-process store: still enforced,
  never switched off, with a warning and a metric. Redis is never the source of
  truth for bookings, payments, refunds or inventory.
- **Metrics:** `prom-client` on loopback-only ports (API 9464, worker 9465);
  request latency labelled by route pattern only. Business gauges (holds,
  manual review, refunds required, outbox, failed emails) come from the process
  running the jobs, so they are reported once.
- **Monitoring stack:** official, checksum-pinned Prometheus 3.13.5 (long-term
  line) and node_exporter 1.12.1 under `/opt`, and the RHEL Grafana package,
  all on 127.0.0.1 with SELinux enforcing and no firewall changes; access via an
  SSH tunnel. Loki is deferred until there is a second server.

## ADR-0028 — Bangla on the customer website (next-intl)

- **Status:** Accepted (2026-11-05)
- **How:** next-intl 4 on the website. The language is a cookie
  (`NEXT_LOCALE`, set by the EN / বাংলা switch in the header); URLs are the
  same in both languages, so links, payment return addresses and emails never
  change. English stays the default. Interface wording lives in
  `apps/web/messages/{en,bn}.json`; static home-page content has a small
  English → Bangla dictionary (`data/home.bn.ts`) that falls back to English.
- **Catalog content:** hotel, tour and destination names show their Bangla
  name when one is filled in (`nameBn`, `titleBn`); descriptions stay as
  entered until the catalog has Bangla description fields.
- **Numbers:** prices keep Latin digits in both languages (৳ 13,248), matching
  the payment page and bank messages; counts and dates use Bangla numerals in
  Bangla (২ রাত, ১২ নভেম্বর).
- **Type:** Hind Siliguri for Bangla text and Noto Serif Bengali for Bangla
  headings, both as fallbacks behind the Latin families and loaded only where
  Bengali glyphs appear (unicode-range). Bengali emphasis stays upright.
- **Validation:** form messages switch to Bangla in the browser
  (`friendlyMessageBn`); the server and API problem details stay English.
- **Guards:** a unit test fails if the two languages differ in keys, if a
  message is not valid ICU, or if the code uses a key that does not exist; the
  end-to-end suite switches to Bangla and runs axe on Bangla pages.
- **Not yet:** the partner portal and the console stay English (B2B and staff
  tools); emails and API error texts are English; SEO hreflang per language
  needs language-specific URLs, which can come with the production domain.

## ADR-0029 — Console control: settings, encrypted credentials, customer accounts

- **Status:** Accepted (2026-11-05)
- **Owner request:** everything should be controllable from the console, not
  by editing server files.
- **Site settings:** `site_settings` holds one JSON value per section
  (general contact details, announcement banner, booking times, payments,
  email), validated by @pegah/contracts. A section saved in the console wins
  over api.env; until then api.env applies, so existing servers keep working.
  Every process re-reads settings every 30 s (and the saving process at once),
  so payment and email adapters change without a restart.
- **Credentials:** SSLCOMMERZ store password and SMTP password are write-only:
  sealed with AES-256-GCM under `SETTINGS_ENCRYPTION_KEY` (32 bytes, server
  env only, never in the database or backups), with the slot name as
  associated data and a key fingerprint to detect a missing or rotated key.
  The API only reports "set"; audit entries never contain them.
- **Permissions:** `settings:manage` (owner, admin) for contact details,
  banner and booking times; `settings:secrets` (owner only) for payment and
  email. The payment simulator can never be chosen from the console, and live
  mode needs an explicit owner approval switch.
- **Customers:** `customer:manage` (owner, admin) disables an account with a
  required reason (ending every session at once) or re-enables it, and can sign
  a customer out everywhere. Bookings are never changed by these actions.
- **Website:** contact details and the announcement come from the public
  `GET /site`; the banner is written in English and Bangla.

## ADR-0030 — Media library stored in MySQL

- **Status:** Accepted (2026-11-05)
- **Need:** staff choose and upload photos for destinations, hotels and tours
  in the console, without server access.
- **Storage:** image bytes in `media_blobs` (LONGBLOB), metadata in
  `media_assets`. No server folder, Nginx location or SELinux change is
  needed, and the nightly database backup includes the photos. Suitable for
  hundreds of photos; move to object storage when the library grows large.
- **Processing:** every upload is decoded with sharp, auto-rotated, limited to
  2000 px, re-encoded as WebP and stored without metadata (no camera or GPS
  data). Only JPEG, PNG and WebP are accepted. The key is a content hash, so the
  same photo is stored once and `/media/{key}` is cached for a year.
- **Upload limit:** Nginx accepts 1 MB bodies, so the console shrinks photos in
  the browser first; the API refuses anything larger.
- **Use:** each destination, hotel and tour can have a main photo
  (`heroMedia`); the website shows it, and falls back to the bundled sample
  photo until one is chosen. A photo in use cannot be deleted.
- **Permissions:** catalog:read to browse, catalog:manage to upload, edit and
  delete; every change is audited. Photos must be owned or licensed and
  credited (docs/design/IMAGE_CREDITS.md).

## ADR-0031 — Home page editor

- **Status:** Accepted (2026-11-05)
- **What staff control:** hero slides (media-library photos with English and
  Bangla place names), featured destinations, featured hotels, featured tours
  (chosen from the real catalog, in order) and up to three promises in English
  and Bangla. Stored in `site_settings["home"]`; `content:manage`; audited.
- **Rendering:** `GET /home` resolves the choices against the published
  catalog at request time, so unpublished or deleted items drop out instead of
  breaking the page. Featured stays and tours show real data (next departure,
  price from) instead of the sample cards and sample prices.
- **Fallback:** a section left empty keeps the built-in content, so the home
  page is never blank while the catalog is being built.

## ADR-0032 — Offers, ads, orders and gift cards

- **Status:** Accepted (2026-11-06)
- **Offers:** packages staff publish in the console (bilingual copy, price in
  paisa, optional "was" price, stock, end date). Customers order them while
  signed in; the server recomputes the total and answers 409 when the shown
  total no longer matches. Stock is reserved by the order and released when it
  is cancelled or expires (48 hours unpaid, reconciled with the provider first).
- **Orders:** one `orders` table for offers and gift cards (`PO-` reference).
  `payments` now target either a booking or an order (CHECK constraint;
  foreign keys `ON UPDATE RESTRICT` because MySQL forbids CHECKs on cascading
  FK columns). Paid online through the same hosted-payment flow, or marked paid
  by staff with a reference (bKash, bank transfer, cash) — `order:manage`
  (owner, admin, finance), audited.
- **Emails:** every new order, payment and payment-review case is written to
  the outbox for the buyer and for staff at the "Email for purchase alerts"
  setting (default pegah.com.bd@gmail.com). Without SMTP they are recorded as
  SKIPPED, never lost silently.
- **Gift cards:** 16-character codes (no 0/O/1/I), stored as SHA-256 for
  lookup plus an AES-256-GCM sealed copy (SETTINGS_ENCRYPTION_KEY) so staff can
  resend; staff only see the last four characters. Sold only when the key is
  configured. Every balance change is a ledger row (ISSUE, REDEEM, RELEASE,
  VOID). Valid two years. Redemption at checkout is the next increment.
- **Ads:** photo banners from the media library on three placements, scheduled
  with start/end, at most two per placement.

## ADR-0033 — Visitor-selectable light and dark theme

- **Status:** Accepted (2026-11-06)
- **Decision:** the tokens already define a dark palette for
  `prefers-color-scheme: dark`; visitors and staff can now override it with a
  toggle in the website, partner portal and console headers. The choice is a
  `pg_theme` cookie (`light` | `dark`, one year, shared on the origin); the
  root layouts render `data-theme` from it on the server, so there is no flash
  of the wrong theme. No cookie means "follow the system".
- **Styling:** components keep using tokens only. A Tailwind `dark:` variant
  (`packages/design-tokens/theme.css`) matches both the explicit choice and the
  system preference; it is used sparingly (the logo swaps to its light version).
- **Verification:** the E2E suite runs the axe scan on website and console
  pages in dark mode.

## ADR-0034 — Paying for bookings with gift cards

- **Status:** Accepted (2026-11-06)
- **Model:** applying a card to a held booking debits the card (REDEEM ledger
  row) and writes a `payments` row with `provider = 'GIFT_CARD'` and
  `gift_card_id` (CHECK `payments_gift_card_chk` ties the two). The rest of the
  system — refund ceilings, the payments list, the booking page — sees it as a
  verified payment. Booking and card rows are locked `FOR UPDATE` in one
  transaction.
- **Amount due:** total minus applied gift card money. Online payment is
  opened for that amount only, and verification requires the provider amount
  to equal it. Applying or removing a card cancels any open payment page, so a
  page opened for the old amount can never confirm the booking (a late payment
  on it goes to manual review as a refund case, unless it again equals the
  amount due).
- **Full coverage:** when cards cover the total, the booking moves
  PENDING_PAYMENT → PAYMENT_PROCESSING → CONFIRMED through the state machine
  (actor PAYMENT_PROVIDER, Pegah being the authority for its own stored value),
  holds become sold and the confirmation email is queued.
- **Unsold bookings:** when an unconfirmed booking expires, fails or is
  cancelled, `BookingStatusService` returns the money to the cards (RELEASE
  rows; gift card payments become CANCELLED). Customers can also remove a card
  while the booking awaits payment. A card voided meanwhile is not refilled.
- **After confirmation:** a cancellation refund that should go back to a card
  is handled by staff issuing a new card from the console (Gift cards → Issue);
  automatic re-crediting is a later improvement.
- **Abuse:** applying is limited to 5 attempts per minute per address, and
  unknown, void and expired codes get the same answer.

## ADR-0035 — Email verification for customer accounts

- **Status:** Accepted (2026-11-06)
- **Flow:** sign-up emails a single-use link (48 hours; only its SHA-256 is
  stored in `email_verification_tokens`; sent directly, never through the
  outbox, because the link is a credential). A new link replaces older ones.
  Customers resend it from the banner on their account pages (3 per minute).
- **Landing page:** `/verify-email` verifies only when the person presses the
  button, so mail-system link scanners cannot verify on their behalf.
- **Enforcement:** the console setting "Customers must confirm their email
  before holding a booking or placing an order" (Settings → Booking rules) is
  off by default and takes effect only while SMTP is configured — without
  working email nobody could verify, so nobody is locked out. When on, holds
  and orders by unverified customers answer 403 `email-not-verified`.
- **Visibility:** staff see "verified / not confirmed" in the customer list and
  detail. Existing accounts start unverified.
- **Not changed:** registration still answers 409 for an existing email
  (known issue); removing that needs a check-your-email sign-up flow.

## ADR-0036 — Customer emails in Bangla

- **Status:** Accepted (2026-11-06)
- **Language choice:** `users.locale` (`en` | `bn`, CHECK
  `users_locale_chk`). Sign-up takes it from the language the website was
  shown in (the next-intl `NEXT_LOCALE` cookie); customers change it under
  Profile → Language for emails. Existing accounts are English.
- **Coverage:** booking held/confirmed/cancellation/refund emails, email
  verification, password reset, order received/paid and gift card delivery
  (in the buyer's language). Staff alerts stay English.
- **Templates:** each template takes the locale; the HTML carries
  `lang="bn"` and a Bengali font fallback. Unit tests check that every Bangla
  email is fully Bangla and that the honesty rules ("not confirmed until
  payment") hold in both languages.
