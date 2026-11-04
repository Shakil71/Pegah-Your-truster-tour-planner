# System Architecture

Status: **partly implemented.** Built: `apps/web`, `apps/admin`, `apps/api`
(auth, RBAC, catalog reads, hotel search, booking status, audit),
`packages/contracts`, `packages/db`, `packages/design-tokens`,
`packages/ui`, `packages/shared` (presentation utilities only, ADR-0012).
Planned: `apps/worker`, `packages/api-client`, `packages/config`.

## 1. Shape

A modular monolith in an npm-workspaces monorepo, orchestrated by Turborepo,
with one `package-lock.json`.

```
apps/
  web/        Next.js App Router — public site + customer account
  admin/      Next.js — staff back office (own origin, own session cookie)
  api/        NestJS + Fastify — REST + OpenAPI; sole owner of business rules
  worker/     NestJS standalone — BullMQ consumers
packages/
  contracts/      Zod schemas: single source for request/response shapes
  api-client/     generated from the API's OpenAPI document
  ui/             design-system components on Radix primitives
  design-tokens/  tokens → CSS variables + Tailwind preset
  db/             Prisma schema, migrations, client (api + worker only)
  config/         shared ESLint, Prettier, tsconfig, env schema
infra/  nginx/ systemd/ deployment/ monitoring/ backup/
```

`apps/supplier` and `apps/agent` are added in Phase 7, not before.

## 2. API modules

| Module       | Owns                                          | Depends on                  |
| ------------ | --------------------------------------------- | --------------------------- |
| auth         | users, sessions, roles, permissions           | audit                       |
| catalog      | destinations, hotels, rooms, tours, media     | —                           |
| inventory    | room inventory, tour capacity, holds          | catalog                     |
| pricing      | rates, taxes, fees, price snapshots           | catalog, inventory          |
| booking      | bookings, items, guests, state machine        | inventory, pricing, payment |
| payment      | payments, payment events, gateway adapters    | booking (via events)        |
| refund       | refunds                                       | payment, booking            |
| notification | email/SMS templates and dispatch (via worker) | outbox                      |
| audit        | audit events                                  | —                           |

Rules: modules call each other only through exported services; cross-module
side effects go through the transactional outbox and the worker.

## 3. Contract flow

```
packages/contracts (Zod)
   ├─► web/admin forms (React Hook Form + zodResolver)
   ├─► api validation pipes (nestjs-zod)
   └─► api OpenAPI document ─► packages/api-client (generated)
```

CI regenerates `apps/api/openapi.json` from the code and fails if it differs from the committed file. `packages/api-client` will be generated from that file when the web apps start calling the API.

## 4. Request path

Browser → Nginx (TLS, compression, static caching) → Next.js (Server Components
by default, minimal client JS) → API (`/api/v1`) → MySQL / Redis. Services bind
to 127.0.0.1; Nginx is the only public listener.

## 5. Cache

Redis is a cache and queue, never the source of truth for bookings, payments,
refunds, balances or inventory. Every key must be registered here before use.

| Key format                         | Owner   | TTL            | Invalidation                     | Fallback                                                      |
| ---------------------------------- | ------- | -------------- | -------------------------------- | ------------------------------------------------------------- |
| `pg:v1:catalog:destination:{slug}` | catalog | 10 min         | on destination update            | read MySQL                                                    |
| `pg:v1:search:hotel:{hash(query)}` | pricing | 2 min          | expiry only; revalidated at hold | read MySQL                                                    |
| `pg:v1:ratelimit:{route}:{ip}`     | auth    | window         | expiry                           | auth routes fail closed; other routes fail open with an alert |
| `bull:{queue}:*`                   | worker  | BullMQ managed | BullMQ                           | outbox retries                                                |

(Planned keys; none is in use yet because Redis is not installed.)

**HTTP caching in use (Phase 3):** public catalog reads send
`Cache-Control: public` — destinations and hotels 300 s, tours 120 s, hotel
search 30 s — with `stale-while-revalidate` of the same length. Owner:
catalog. Invalidation: expiry only. Search prices are labelled indicative
(`pricedAt`) and are always recomputed under a row lock before a hold.
Session, auth and admin responses send `Cache-Control: no-store`.

## 6. Background jobs (planned)

| Queue         | Job                                     | Trigger                     |
| ------------- | --------------------------------------- | --------------------------- |
| notifications | send booking email / SMS                | outbox event                |
| documents     | render voucher and invoice PDF          | booking confirmed           |
| holds         | expire inventory holds                  | delayed job at `expires_at` |
| payments      | reconcile pending payments with gateway | schedule (every 15 min)     |

## 7. Deployment

Native RHEL with systemd units `pegah-web`, `pegah-admin`, `pegah-api`,
`pegah-worker`. See `docs/operations/DEPLOYMENT.md`.
