# API Specification

Status: **implemented through Phase 4, plus the payment module** (switched off until a provider is configured, ADR-0022). The generated OpenAPI document is
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
- `POST /bookings` requires an `Idempotency-Key` header (16–128 visible
  characters). Same key + same body replays the stored response with
  `Idempotent-Replayed: true`; same key + different body is `422
idempotency-key-reused`; a concurrent duplicate is `409
idempotency-in-progress`. Keys live 24 hours (ADR-0018).
- Money: `{ "amountMinor": 1250000, "currency": "BDT" }` — integer paisa.
  Totals are computed only by the server.
- Timestamps: ISO 8601 UTC. Calendar dates (`checkIn`): `YYYY-MM-DD` in the
  Asia/Dhaka calendar.
- Auth: session cookie (HttpOnly, SameSite=Lax, Secure and `__Host-` prefix in
  production). Mutations need `X-CSRF-Token` (from login or
  `GET /auth/session`) and an allowed `Origin` (ADR-0015).
- Rate limits: 300 requests/min per IP overall; register 5/min, login 10/min,
  staff login 5/min, booking creation 20/min. Exceeding returns `429`.

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
| GET    | /hotels/{slug}/offers       | public                                            | Every active room priced for one stay             |
| GET    | /quotes/hotel, /quotes/tour | public                                            | Indicative price and availability for checkout    |
| POST   | /bookings                   | customer + CSRF + Idempotency-Key                 | Create booking and hold inventory (15 min)        |
| POST   | /me/bookings/{id}/cancel    | customer + CSRF                                   | Cancel an unpaid booking; releases the hold       |
| GET    | /admin/dashboard            | `dashboard:read`                                  | KPIs, day series, occupancy, departures, activity |
| GET    | /admin/staff                | `user:manage`                                     | Staff accounts and roles                          |
| POST   | /admin/staff                | `user:manage` + CSRF                              | Create staff (owner role: owners only; audited)   |
| PATCH  | /admin/staff/{id}           | `user:manage` + CSRF                              | Change roles or disable (audited)                 |
| GET    | /admin/audit                | `audit:read`                                      | Audit log, newest first, keyset pages             |

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

### Booking creation (ADR-0018)

The body is `CreateBookingRequest`: `product` `HOTEL` (`roomId`, `checkIn`,
`checkOut`, `rooms`) or `TOUR` (`departureId`), plus `adults`, `children`,
`contact` (name, email, `+8801…` phone), `guests` (one per traveller, lead
adult first) and `expectedTotal` (the quoted total). The server locks the rows,
recomputes the price and answers `409 price-changed` if it differs,
`409 not-available` if it sold out, otherwise `201` with the booking in
`PENDING_PAYMENT` and `holdExpiresAt`. Unpaid holds expire to `EXPIRED` and
the inventory goes back on sale.

## Offers, orders and gift cards (ADR-0032)

| Method              | Path                                   | Access                      | Purpose                                      |
| ------------------- | -------------------------------------- | --------------------------- | -------------------------------------------- |
| GET                 | /offers, /offers/{slug}                | public                      | Published offers                             |
| GET                 | /ads?placement=                        | public                      | Live banners for a placement                 |
| GET                 | /gift-cards/availability               | public                      | Whether gift cards are on sale               |
| GET                 | /gift-cards/balance?code=              | public, rate limited        | Balance by code                              |
| GET                 | /me/orders, /me/orders/{id}            | customer                    | Own orders                                   |
| POST                | /me/orders/offer, /me/orders/gift-card | customer, CSRF              | Place an order (server recomputes the total) |
| POST                | /me/orders/{id}/payment-session        | customer, CSRF              | Start hosted payment                         |
| GET/POST/PUT        | /admin/offers[/{id}]                   | promotion:manage            | Manage offers                                |
| GET/POST/PUT/DELETE | /admin/ads[/{id}]                      | promotion:manage            | Manage ads                                   |
| GET                 | /admin/orders[/{id}]                   | payment:read                | Orders                                       |
| POST                | /admin/orders/{id}/mark-paid, /cancel  | order:manage                | Offline payment, cancel                      |
| GET/POST            | /admin/gift-cards                      | payment:read / order:manage | List, issue without payment                  |
| POST                | /admin/gift-cards/{id}/void, /resend   | order:manage                | Void, resend code                            |

Gift cards at checkout (ADR-0034):

| Method | Path                                    | Access                | Purpose                              |
| ------ | --------------------------------------- | --------------------- | ------------------------------------ |
| POST   | /me/bookings/{id}/gift-card             | customer, CSRF, 5/min | Apply a card to a held booking       |
| DELETE | /me/bookings/{id}/gift-card/{paymentId} | customer, CSRF        | Remove it; money returns to the card |

Email verification (ADR-0035):

| Method | Path                   | Access                | Purpose                              |
| ------ | ---------------------- | --------------------- | ------------------------------------ |
| POST   | /me/email-verification | customer, CSRF, 3/min | Email a new confirmation link        |
| POST   | /auth/verify-email     | public, 10/min        | Confirm with the token from the link |

## Console control (ADR-0029)

| Method | Path                           | Permission       | Purpose                                 |
| ------ | ------------------------------ | ---------------- | --------------------------------------- |
| GET    | /admin/settings/site           | settings:read    | Editable settings (secrets only as set) |
| PUT    | /admin/settings/general        | settings:manage  | Contact details                         |
| PUT    | /admin/settings/announcement   | settings:manage  | Banner in English and Bangla            |
| PUT    | /admin/settings/booking        | settings:manage  | Hold and payment-extension minutes      |
| PUT    | /admin/settings/payments       | settings:secrets | SSLCOMMERZ (password write-only)        |
| PUT    | /admin/settings/email          | settings:secrets | SMTP (password write-only)              |
| POST   | /admin/settings/email/test     | settings:secrets | Test email to the signed-in owner       |
| PATCH  | /admin/customers/{id}          | customer:manage  | Disable (reason required) or enable     |
| POST   | /admin/customers/{id}/sign-out | customer:manage  | End every session of the customer       |
| GET    | /site                          | public           | Contact details and active banner       |

## System settings

| Method | Path            | Permission    | Purpose                                                  |
| ------ | --------------- | ------------- | -------------------------------------------------------- |
| GET    | /admin/settings | settings:read | Payment, email, booking and session status; build facts. |

Read-only and secret-free: it reports whether credentials are set, never
their values. Configuration changes are made in the server environment files.

## Partner portals (ADR-0026)

| Method   | Path                                    | Access          | Purpose                                  |
| -------- | --------------------------------------- | --------------- | ---------------------------------------- |
| POST     | /partner/auth/login, /logout, /password | partner         | Sign in, sign out, change password       |
| GET      | /partner/auth/session                   | partner         | Current partner user and CSRF token      |
| GET      | /partner/overview                       | partner         | Supplier inventory or agent totals       |
| GET      | /partner/reservations                   | supplier        | Bookings for own hotels and tours        |
| GET/PUT  | /partner/rooms/{id}/calendar            | supplier (owns) | Room inventory and rates                 |
| PATCH    | /partner/departures/{id}                | supplier (owns) | Seats, close or reopen                   |
| GET/POST | /partner/bookings                       | agent           | Client bookings / book (Idempotency-Key) |
| GET      | /partner/bookings/{id}                  | agent (own)     | Booking detail with commission           |
| POST     | /partner/bookings/{id}/payment-session  | agent (own)     | Hosted payment page                      |
| GET      | /partner/statement?month=YYYY-MM        | agent           | Monthly commission statement (Dhaka)     |
| GET/POST | /admin/partners                         | partner:manage  | List / create partner with first user    |
| PUT      | /admin/partners/{id}                    | partner:manage  | Edit, commission, suspend                |
| POST     | /admin/partners/{id}/members            | partner:manage  | Add a user                               |
| PATCH    | /admin/partners/{id}/members/{memberId} | partner:manage  | Disable or enable a user                 |
| PUT      | /admin/partners/{id}/ownership          | partner:manage  | Assign hotels and tours to a supplier    |

Foreign or unknown ids return 404. Admin hotel and tour inputs accept
`supplierId`; their details return `supplier`.

## Promotions, reports and content (ADR-0025)

| Method   | Path                        | Permission       | Purpose                            |
| -------- | --------------------------- | ---------------- | ---------------------------------- |
| GET/POST | /admin/promotions           | promotion:manage | List (with redemptions) / create   |
| PUT      | /admin/promotions/{id}      | promotion:manage | Edit, pause or resume              |
| GET      | /admin/reports/sales        | report:read      | Totals, by product, status and day |
| GET      | /admin/reports/bookings.csv | report:read      | One row per booking (CSV download) |
| GET/POST | /admin/pages                | content:manage   | Content pages                      |
| GET/PUT  | /admin/pages/{slug}         | content:manage   | Read / edit a page                 |
| GET      | /pages/{slug}               | public           | Published page only                |

Quotes and `POST /bookings` accept an optional `promoCode`; quotes return
`promotion` or `promoError`, and every price breakdown has a `discount` line.

## Account, cancellations and refunds (ADR-0024)

| Method     | Path                                       | Auth                           | Purpose                                  |
| ---------- | ------------------------------------------ | ------------------------------ | ---------------------------------------- |
| GET/PUT    | /me/profile                                | customer (+CSRF)               | Profile                                  |
| POST       | /me/password                               | customer + CSRF                | Change password; signs out other devices |
| GET/POST   | /me/travellers                             | customer (+CSRF)               | Saved travellers                         |
| PUT/DELETE | /me/travellers/{id}                        | customer + CSRF                | Edit / remove a saved traveller          |
| POST       | /me/bookings/{id}/cancellation-request     | customer + CSRF                | Ask to cancel a confirmed booking        |
| POST       | /auth/password-reset/request               | public (5/min)                 | Always 202; emails a single-use link     |
| POST       | /auth/password-reset/confirm               | public (10/min)                | Set a new password; revokes sessions     |
| POST       | /admin/bookings/{id}/cancellation-decision | booking:override_status + CSRF | Approve (with refund) or reject          |
| GET        | /admin/refunds                             | payment:read                   | Refunds to pay / paid                    |
| POST       | /admin/refunds/{id}/paid                   | refund:approve + CSRF          | Record the provider/bank reference       |

Refunds to gift cards (ADR-0037): an approved refund is credited to the
booking's gift cards first. Those refund rows are created `PAID` with
`providerRef: "GIFT_CARD"` and `giftCardLast4` set (marking them paid again
answers 409); only the remainder is a `PENDING` refund. With no remainder the
booking ends `REFUNDED` in the same request.

## Operations admin (ADR-0023)

| Method   | Path                                              | Permission                      | Purpose                                  |
| -------- | ------------------------------------------------- | ------------------------------- | ---------------------------------------- |
| GET/POST | /admin/destinations                               | catalog:read/manage             | List / create destinations               |
| PUT      | /admin/destinations/{slug}                        | catalog:manage                  | Edit a destination                       |
| GET/POST | /admin/hotels                                     | catalog:read/manage             | List / create hotels                     |
| GET/PUT  | /admin/hotels/{slug}                              | catalog:read/manage             | Hotel with rooms / edit                  |
| POST     | /admin/hotels/{slug}/rooms, PUT /admin/rooms/{id} | catalog:manage                  | Room types                               |
| GET/PUT  | /admin/rooms/{id}/calendar                        | catalog:read / inventory:manage | Per-night inventory and rates; bulk edit |
| GET/POST | /admin/tours                                      | catalog:read/manage             | List / create tours                      |
| GET/PUT  | /admin/tours/{slug}                               | catalog:read/manage             | Tour with departures / edit              |
| POST     | /admin/tours/{slug}/departures                    | inventory:manage                | Add a departure                          |
| PATCH    | /admin/departures/{id}                            | inventory:manage                | Capacity, prices, close/reopen/cancel    |
| GET      | /admin/customers, /admin/customers/{id}           | customer:read                   | Customers and their bookings             |

`GET /admin/bookings` also filters by `customerId`, `hotel` and `tour`.
Booking detail includes `customer` and `product` for linking.

## Payments (ADR-0022)

| Method | Path                                 | Auth                | Purpose                                                   |
| ------ | ------------------------------------ | ------------------- | --------------------------------------------------------- |
| POST   | /me/bookings/{id}/payment-session    | customer + CSRF     | Open a hosted payment page; returns `redirectUrl`         |
| POST   | /payments/sslcommerz/ipn             | provider (verified) | IPN; always 200 once recorded                             |
| POST   | /payments/sslcommerz/return/{result} | provider (verified) | Browser return; 303 to `/account/bookings/{id}?payment=…` |
| GET    | /admin/payments                      | `payment:read`      | Payment attempts, newest first                            |

Callbacks are excluded from the OpenAPI document. They carry no session or
CSRF token (cross-site form POSTs); authenticity comes from re-verifying every
outcome with the provider server-to-server. `503 payments-unavailable` while
`PAYMENT_PROVIDER=none`. Switch-on guide: `docs/operations/SSLCOMMERZ_INTEGRATION.md`.

## Planned

| Method | Path                        | Purpose              |
| ------ | --------------------------- | -------------------- |
| POST   | /admin/payments/{id}/refund | Refund via the API   |
| POST   | /bookings/{id}/cancellation | Request cancellation |

## Visa services and flight requests (ADR-0039)

| Method   | Path                                     | Access                   | Purpose                                                                                   |
| -------- | ---------------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------- |
| GET      | /visas, /visas/{slug}                    | public                   | Published visa services                                                                   |
| POST     | /me/requests/visa, /me/requests/flight   | customer + CSRF (10/min) | New request (201); verified email when required                                           |
| GET      | /me/requests, /me/requests/{id}          | customer (own only)      | List / detail with timeline and documents                                                 |
| POST     | /me/requests/{id}/reply                  | customer + CSRF          | Message; NEEDS_INFO → SUBMITTED                                                           |
| POST     | /me/requests/{id}/cancel                 | customer + CSRF          | Until paid                                                                                |
| POST     | /me/requests/{id}/documents?label=&name= | customer + CSRF (20/min) | Raw `application/octet-stream`, PDF/JPEG/PNG ≤ 5 MB                                       |
| GET      | /me/requests/{id}/documents/{doc}        | customer (own only)      | Decrypted download (`no-store`, attachment)                                               |
| GET      | /admin/requests, /admin/requests/{id}    | service:manage           | Queue (kind, status, search) / detail incl. internal                                      |
| POST     | /admin/requests/{id}/actions             | service:manage + CSRF    | NEEDS_INFO, QUOTE, MARK_PAID, START, COMPLETE, REJECT, CANCEL, NOTE with `expectedStatus` |
| POST     | /admin/requests/{id}/documents           | service:manage + CSRF    | Staff upload (e-visa, ticket); audited                                                    |
| GET      | /admin/requests/{id}/documents/{doc}     | service:manage           | Download; audited                                                                         |
| GET      | /admin/visa-products                     | catalog:read             | Visa catalogue with open request counts                                                   |
| POST/PUT | /admin/visa-products[/{slug}]            | catalog:manage + CSRF    | Create / edit                                                                             |

Uploads answer 503 `uploads-off` while `DOCUMENT_ENCRYPTION_KEY` is unset,
415 for other file types, 413 above 5 MB, 409 once the request is closed.
