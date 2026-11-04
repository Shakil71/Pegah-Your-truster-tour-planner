# Changelog

All notable changes to this project. Format based on Keep a Changelog.

## [Unreleased]

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
