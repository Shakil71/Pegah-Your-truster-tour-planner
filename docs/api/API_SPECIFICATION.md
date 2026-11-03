# API Specification

Status: **planned**. No endpoints exist yet. Once `apps/api` exists, the
generated OpenAPI document (`/api/docs`) is authoritative and this file only
summarises conventions.

## Conventions

- Base path `/api/v1`; JSON only; `camelCase` fields.
- Request and response shapes come from `packages/contracts` (ADR-0002).
- Errors follow RFC 9457 problem details: `type`, `title`, `status`, `detail`,
  `errors[]` for field validation.
- Pagination: cursor-based (`?cursor=&limit=`), `limit` max 100.
- Mutations that create bookings or payments require an `Idempotency-Key` header.
- Money in responses: `{ "amountMinor": 1250000, "currency": "BDT" }`.
- Timestamps: ISO 8601 UTC.
- Auth: session cookie (HttpOnly, Secure, SameSite=Lax); CSRF token header on
  cookie-authenticated mutations.

## Planned slice 1 resources

| Method | Path                                      | Purpose                                        |
| ------ | ----------------------------------------- | ---------------------------------------------- |
| POST   | /auth/register, /auth/login, /auth/logout | Session lifecycle                              |
| GET    | /destinations, /destinations/{slug}       | Discovery                                      |
| GET    | /hotels/search                            | Availability and price search                  |
| GET    | /hotels/{slug}                            | Property detail and rooms                      |
| GET    | /tours, /tours/{slug}                     | Tour listing and detail                        |
| POST   | /bookings                                 | Create booking and inventory hold (idempotent) |
| POST   | /bookings/{id}/payment-session            | Start hosted payment                           |
| POST   | /webhooks/payments/sslcommerz             | Verified payment callback                      |
| POST   | /bookings/{id}/cancellation               | Request cancellation                           |
| GET    | /me/bookings, /me/bookings/{id}           | Customer bookings                              |
| GET    | /health/live, /health/ready               | Health checks                                  |
