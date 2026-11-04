# Security Model

Status: **partly implemented (Phase 3, ADR-0015).** Implemented in `apps/api`:
Argon2id hashing with timing-equalised failures; server-side sessions storing
only token hashes; separate customer/staff cookies and timeouts; HMAC CSRF
tokens; Origin allow-list; global permission guard; ownership-scoped customer
queries (404 for others' bookings); Zod validation of every input and output;
RFC 9457 errors without internals; Helmet headers (CSP `default-src 'none'`,
HSTS when secure, no-referrer, nosniff); strict CORS allow-list; 100 KB body
limit; per-route rate limits (in-memory until Redis); log redaction of
cookies, authorization and CSRF headers; audit events for staff logins,
staff creation and manual booking status changes; `seed:sample` refuses to
run in production; production config refuses insecure cookies or public
OpenAPI. Not yet: Redis-backed limits, email verification, password reset,
staff 2FA, CodeQL/gitleaks in CI, field encryption for identity documents.

## Authentication and sessions

- Argon2id password hashing (memory-hard parameters tuned on the server).
- Server-side sessions; cookie holds a random token, DB stores only its hash.
- Cookies: HttpOnly, Secure (HTTPS), SameSite=Lax; admin uses a separate cookie
  on its own origin with shorter idle timeout.
- CSRF token on cookie-authenticated mutations.
- Login, registration and reset are rate limited and fail closed if Redis is down.

## Authorization

- RBAC: permission keys defined once in `packages/contracts`, checked by API guards.
- Resource ownership checked server-side on every request (customer → own
  bookings; supplier → own properties; agent → own bookings).
- UI hiding is convenience only, never a control.

## Data protection

- Passport and identity document fields encrypted at application level.
- No raw card data: hosted payment pages only.
- Uploads: type sniffing, size limits, randomised names, stored outside the web root.
- Never log passwords, tokens, payment credentials, identity documents or secrets.

## Platform

- Security headers: CSP, HSTS, X-Content-Type-Options, Referrer-Policy, frame-ancestors.
- Strict CORS allow-list.
- Secrets only in `/opt/pegah/shared/env/*.env` (0600) and GitHub encrypted secrets.
- SELinux enforcing, firewalld minimal openings, least-privilege service user.
- Dependency scanning (npm audit, CodeQL) and secret scanning (gitleaks) in CI.

## Audit

Sensitive actions (role changes, refunds, manual booking state changes, price
overrides, staff logins) write append-only `audit_events`.

## Incident log

- 2026-11-04: the production server root password was shared in a chat session.
  It was not used or stored. Owner advised to rotate it, disable root SSH login
  and switch to key-based access for a non-root deploy user. **Open** until
  the owner confirms rotation.
- 2026-11-04 (later): the root password was shared in chat a second time with
  a request to log in. It was not used or stored; key-based access for a
  non-root `pegah` user was proposed instead. Still **open**.

## Staff management and booking safety (Phases 3–4)

- Only an owner can grant or remove the owner role or change an owner; nobody
  can disable themselves or drop their own roles; at least one active owner
  must remain; disabling a person revokes their sessions at once. All changes
  are audited.
- Booking creation needs a customer session, CSRF, an allowed Origin and an
  `Idempotency-Key`; prices are recomputed under row locks; customers can see
  and cancel only their own bookings (others return 404).
- Sign-in requires HTTPS (Secure `__Host-` cookies). The pre-launch server uses
  a self-signed certificate on :8443 (ADR-0019); no setting was weakened.

## Payments (ADR-0022)

- Hosted payment pages only; Pegah never sees card numbers. Callback payloads
  are stored as a whitelist of fields (no card data).
- Callbacks are untrusted input: every outcome is re-verified with the provider
  server-to-server and must match the booking amount and currency exactly.
- The store password lives only in `api.env` (0600), is redacted from request
  logs and never included in error messages.
- The development simulator cannot be enabled in production; live mode needs
  `SSLCOMMERZ_LIVE_APPROVED=true`.
