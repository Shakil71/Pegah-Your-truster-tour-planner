# Project Status

_Last updated: 2026-11-04_

## Current phase

**Phase 2 (design) — implemented in code.** Homepage and admin dashboard UI
are built in Next.js on the monorepo, with sample data. Backend (Phase 3) has
not started.

## Completed

- Phase 1: repository audit, environment assessment, approved proposal,
  `CLAUDE.md`, full documentation set, ADR-0001 … ADR-0007.
- Homepage design v2 (immersive, booking-first) approved by the owner.
- Primary colour `#FF852F` adopted with accessible text variants (ADR-0010).
- npm-workspaces + Turborepo monorepo with pinned toolchain (ADR-0011).
- `packages/design-tokens` (CSS variables, Tailwind v4 theme, TS values).
- `packages/ui` (icon set, logo, stitch, button styles).
- `packages/shared` (money formatting, Asia/Dhaka date, six seasons) with
  unit tests (ADR-0012).
- `apps/web`: homepage with hero slideshow, Radix tabbed search and guests
  popover, trending carousel, mood mosaic, stay cards, six-season panel,
  tours, promises, newsletter, footer with photo credits. Images served via
  `next/image` (AVIF/WebP).
- `apps/admin`: dashboard (greeting, KPI cards with sparklines, revenue chart
  with crosshair tooltip, keyboard reading and table view, booking pipeline,
  occupancy heatmap, departures, recent bookings, activity feed), bookings
  page with search and status filters, designed placeholders for planned
  modules.
- GitHub Actions CI workflow (format, lint, typecheck, test, build).

## In progress

- Phase 2 design for remaining pages: search results, property page, tour
  page, checkout, account.

## Next recommended actions

1. Owner reviews the running homepage (port 3000) and admin (port 3001).
2. Owner runs the read-only server inspection in `operations/DEPLOYMENT.md`
   (decides ADR-0008 Redis/Valkey and ADR-0009 Node version).
3. Design and build the hotel search results and property pages.
4. Phase 3: `apps/api` (NestJS + Fastify), `packages/contracts`, `packages/db`
   (Prisma + MySQL 8.4), auth and RBAC. Admin then switches from sample data
   to the API.

## Blockers

| Blocker                           | Blocks                                        | Owner                           |
| --------------------------------- | --------------------------------------------- | ------------------------------- |
| RHEL version unknown              | Node/MySQL/Redis version lock (ADR-0008/0009) | Owner: run inspection           |
| Root password exposed in chat     | Server security                               | Owner: rotate, disable root SSH |
| No local MySQL / Redis            | Phase 3 integration work                      | Owner: approve WSL setup        |
| No flight supplier contract       | Flights                                       | Owner                           |
| No SSLCOMMERZ sandbox credentials | Payment integration (Phase 5)                 | Owner                           |
| Domain not chosen                 | TLS, email DNS                                | Owner                           |

## Known issues

- Node.js is installed at `C:\Program Files\nodejs` but VS Code's terminal
  PATH does not include it until VS Code is restarted.
- Node 26 prints a `module.register` deprecation warning during `next build`;
  harmless, and CI uses Node 22.
- Admin auth does not exist yet: the admin app must not be exposed publicly.
- `npm audit --omit=dev`: 0 vulnerabilities after upgrading Next.js to 16.4.5
  (critical advisories in ≤ 16.4.0, see ADR-0011).
- npm 11 holds back the `esbuild` postinstall script (used by Vitest) until it
  is approved with `npm install-scripts approve esbuild`; tests pass without it.
- Repository name contains the typo "truster".

## Latest validation results (2026-11-04, local, Node 26.13)

| Check                                  | Result                                                                       |
| -------------------------------------- | ---------------------------------------------------------------------------- |
| `vitest run`                           | 17/17 passed                                                                 |
| ESLint (web, admin)                    | Passed, 0 problems                                                           |
| TypeScript `tsc --noEmit` (web, admin) | Passed                                                                       |
| `next build` (web, admin)              | Passed; web `/` static with 1 h revalidate, admin dynamic                    |
| Prettier `--check .`                   | Passed after formatting                                                      |
| HTTP smoke test (`next start`)         | web `/` 200; admin `/`, `/bookings`, `/refunds` 200; unknown admin route 404 |
| Image optimisation                     | `/_next/image` serves AVIF (790 KB source → ~25 KB)                          |
| Token contrast (WCAG)                  | All text pairs ≥ 4.5:1 after darkening `ink-3`                               |
| axe / Lighthouse / Playwright          | Not run yet — no browser automation set up                                   |
| GitHub Actions CI                      | Workflow added; first run happens on push                                    |

## Approvals required

- Feedback on the running homepage and admin dashboard.
- Read-only server inspection (owner runs it, or approves non-root SSH key).
- WSL distro with MySQL 8.4 and Redis/Valkey for Phase 3.
