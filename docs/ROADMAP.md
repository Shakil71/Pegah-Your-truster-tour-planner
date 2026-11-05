# Roadmap and completion checklist

_Last updated: 2026-11-04._ One list of everything in scope
(`requirements/PRODUCT_REQUIREMENTS.md`), worked through phase by phase.
Status per item: ✅ done (built, tested, documented) · 🔶 partly done ·
⏳ next · ⛔ blocked (named dependency) · ⬜ not started.

## Phase 1 — Discovery and documentation ✅

- ✅ Audit, proposal, CLAUDE.md, full documentation set, ADR-0001 … ADR-0007.

## Phase 2 — Design system and front-end shells ✅

- ✅ Monorepo, design tokens (#FF852F), UI package, homepage, admin design, CI.

## Phase 3 — Backend foundation and live admin ✅

- ✅ Contracts, Prisma schema + migrations, NestJS API, auth, RBAC, CSRF, audit.
- ✅ Admin staff sign-in, dashboard, bookings, staff and roles, audit log.
- ✅ Generated API client; MySQL integration tests in CI; pull-based CD.

## Phase 4 — Search and booking with holds ✅

- ✅ Hotel search, property page, tours, departure picker, quotes.
- ✅ Booking creation with row locks, idempotency, price revalidation, 15-minute holds.
- ✅ Customer register / sign in / sign out, My trips, cancel unpaid hold, hold expiry.

## Phase 5 — Payments, confirmation, documents ✅ (switch-ons pending: SSLCOMMERZ, SMTP)

- ✅ Payment module, provider port, simulator, server-side verification,
  confirmation with hold conversion, refund-required flagging, reconciliation.
- ⛔ SSLCOMMERZ switched on — needs sandbox credentials
  (`operations/SSLCOMMERZ_INTEGRATION.md`).
- ✅ Booking voucher and invoice (printable, confirmed bookings only).
- ✅ Cancellation request, staff decision, refund workflow (money returned in the provider panel).
- ✅ Password reset and password change. ⬜ Email verification at sign-up.
- ✅ Transactional email via the outbox. ⛔ Real sending needs SMTP credentials.
- ✅ Traveller profiles and account profile editing.

## Phase 6 — Operations admin ✅ (media uploads pending server storage)

- ✅ Destinations, hotels, room types, inventory and rate calendar (bulk, weekday rules).
- ✅ Tours and departures with seat safety (close / reopen / cancel rules).
- ✅ Customers list and detail; booking ↔ customer ↔ hotel/tour ↔ audit links;
  dashboard → catalog links; scoped booking lists.
- ✅ Coupons and promotions (server-side rules, limits under lock).
- ✅ Sales report and bookings CSV (occupancy is on the dashboard and room calendar).
- ✅ Content pages (About, Terms, Privacy…) with admin editor.
- ⛔ Media uploads and homepage section editing — need a server storage folder, an Nginx `/media` location and SELinux labels (owner, root).

## Phase 7 — Partner portals ✅

- ✅ Supplier portal: hotel/operator owners manage their own rooms, rates and departures and see reservations (ADR-0026).
- ✅ B2B agent portal: agent accounts, book for a client, commission, monthly statements. ⬜ Agent net rates (when a contract needs them).
- ✅ Refunds console for finance (`refund:approve`), delivered in Phase 5.
- ✅ Admin: Suppliers and agents page (`partner:manage`).

## Phase 8 — Third-party supply ⛔

- ⛔ Flights (search, fare rules, revalidation, ticketing) — needs a GDS or consolidator contract.
- ⛔ Third-party hotels — needs a bedbank contract.
- ⬜ Visa services — needs the secure document storage design first.

## Cross-cutting (before real customers)

- 🔶 HTTPS: self-signed on :8443 ready (owner runs `enable-https.sh`); trusted
  certificate needs a domain.
- ✅ Playwright end-to-end + axe accessibility checks in CI (deploys require them).
- ✅ Worker process and Redis rate limits (ADR-0027); owner runs `enable-worker-redis.sh` once.
- ✅ Monitoring: Prometheus, node_exporter, Grafana dashboard and alert rules (owner runs `enable-monitoring.sh`). ⬜ Loki (with a second server), alert notifications (need a destination), backup restore drill.
- ✅ Bangla on the customer website (ADR-0028). ⬜ Bangla emails and partner portal.
- ⬜ Staging instance; remove demo data before launch.
