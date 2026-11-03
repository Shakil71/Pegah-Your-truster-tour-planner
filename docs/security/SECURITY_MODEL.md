# Security Model

Status: **planned**. Controls below are requirements; none are implemented yet.

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
