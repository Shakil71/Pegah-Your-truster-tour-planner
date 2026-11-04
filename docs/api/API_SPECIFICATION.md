# API Specification

Status: **partly implemented (Phase 3).** The generated OpenAPI document is
authoritative: `apps/api/openapi.json` (committed, drift-checked in CI) and
`GET /api/v1/docs/openapi.json` when `OPENAPI_ENABLED=true` (never in
production). This file summarises conventions and the endpoint inventory.

## Conventions

- Base path `/api/v1`; JSON only; `camelCase` fields.
- Request and response shapes come from `packages/contracts` (ADR-0002).
  Responses are validated and stripped against their schema before sending,
  so internal fields (password hashes, internal ids) cannot leak.
- Errors follow RFC 9457 problem details (`application/problem+json`):
  `type` (stable slug such as `/problems/validation`), `title`, `status`,
  `detail` (safe to show users), `instance`, `requestId`, and `errors[]`
  (`path`, `message`, `code`) for field validation. Database outages return
  `503 /problems/service-unavailable`.
- Pagination: keyset, `?cursor=&limit=`; `limit` max 100; `nextCursor` is
  `null` on the last page.
- Mutations that create bookings or payments will require an
  `Idempotency-Key` header (table exists; endpoints arrive in Phase 4).
- Money: `{ "amountMinor": 1250000, "currency": "BDT" }` — integer paisa.
  Totals are computed only by the server.
- Timestamps: ISO 8601 UTC. Calendar dates (`checkIn`): `YYYY-MM-DD` in the
  Asia/Dhaka calendar.
- Auth: session cookie (HttpOnly, SameSite=Lax, Secure and `__Host-` prefix in
  production). Mutations need `X-CSRF-Token` (from login or
  `GET /auth/session`) and an allowed `Origin` (ADR-0015).
- Rate limits: 300 requests/min per IP overall; register 5/min, login 10/min,
  staff login 5/min. Exceeding returns `429`.

## Implemented endpoints

| Method | Path                        | Auth                                              | Purpose                                           |
| ------ | --------------------------- | ------------------------------------------------- | ------------------------------------------------- |
| GET    | /health/live                | public                                            | Liveness                                          |
| GET    | /health/ready               | public                                            | Readiness (DB check, 503 when down, 2 s bound)    |
| POST   | /auth/register              | public                                            | Create customer account and session               |
| POST   | /auth/login                 | public                                            | Customer session                                  |
| POST   | /auth/logout                | customer + CSRF                                   | Revoke session                                    |
| GET    | /auth/session               | customer                                          | Current user and CSRF token                       |
| POST   | /staff/auth/login           | public                                            | Staff session (audited, success and failure)      |
| POST   | /staff/auth/logout          | staff + CSRF                                      | Revoke staff session                              |
| GET    | /staff/auth/session         | staff                                             | Current staff user, roles, permissions, CSRF      |
| GET    | /destinations               | public                                            | Published destinations with hotel/tour counts     |
| GET    | /destinations/{slug}        | public                                            | Destination with hotels and tours                 |
| GET    | /hotels/search              | public                                            | Availability and server-computed price per hotel  |
| GET    | /hotels/{slug}              | public                                            | Hotel detail and active rooms                     |
| GET    | /tours, /tours/{slug}       | public                                            | Tours with from-price and upcoming departures     |
| GET    | /me/bookings                | customer                                          | Own bookings (ownership enforced in the query)    |
| GET    | /me/bookings/{id}           | customer                                          | Own booking detail; others' bookings return 404   |
| GET    | /admin/bookings             | `booking:read`                                    | Filter by status, product, reference/name/email   |
| GET    | /admin/bookings/{id}        | `booking:read`                                    | Detail with status history and allowed next steps |
| POST   | /admin/bookings/{id}/status | `booking:read` + `booking:override_status` + CSRF | State-machine transition with reason (audited)    |

### Hotel search rules

Query: `destination`, `checkIn`, `checkOut`, `adults` (default 2), `children`
(default 0), `rooms` (default 1). Check-in may not be in the past (Dhaka
calendar) or more than 365 days ahead; stays are 1–30 nights. A room type
qualifies only if every night has inventory with enough free rooms
(`total − held − sold`) and a rate in the hotel's currency, and the guests fit
(every room needs an adult). Price = sum of nightly rates × rooms, plus
service charge on the base, plus VAT on base + service charge, each rounded
half-up to the paisa. One cheapest offer per hotel, sorted by total. Results
carry `pricedAt` and are indicative until the booking flow revalidates them.

### Booking status changes

`expectedStatus` gives optimistic concurrency: if the booking changed since
the operator loaded it, the API answers `409 booking-status-changed`. Edges
not allowed for staff answer `422 illegal-transition`. Nobody can move a
booking straight to `CONFIRMED`; staff can confirm only from `MANUAL_REVIEW`.

## Planned (Phases 4–5)

| Method | Path                           | Purpose                                        |
| ------ | ------------------------------ | ---------------------------------------------- |
| POST   | /bookings                      | Create booking and inventory hold (idempotent) |
| POST   | /bookings/{id}/payment-session | Start hosted payment                           |
| POST   | /webhooks/payments/sslcommerz  | Verified payment callback                      |
| POST   | /bookings/{id}/cancellation    | Request cancellation                           |
