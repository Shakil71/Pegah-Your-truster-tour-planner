# Project Status

_Last updated: 2026-11-04_

## Current phase

**Phase 1 complete → Phase 2 (design) started.**

## Completed

- Repository audit: repository was empty (unborn `main`, no files).
- Development environment assessment (Windows 10 workstation).
- Phase 1 proposal reviewed and approved by the owner: requirements, monorepo
  architecture, database overview, three design directions, dependency
  matrix, sync strategy, testing strategy, RHEL deployment architecture, Git
  workflow, roadmap, backlog, integrations, open decisions.
- `CLAUDE.md` and the documentation set written.
- ADR-0001 … ADR-0007 accepted (see `architecture/DECISIONS.md`).
- Design direction **Kantha** chosen; static homepage prototype with licensed
  Bangladesh photography in `docs/design/prototype/`.

## In progress

- Phase 2 design: homepage prototype v2 (immersive, booking-first) is ready
  for owner review. v1 was judged not striking enough by the owner.

## Next recommended actions

1. Owner reviews the homepage prototype and gives design feedback.
2. Owner runs the read-only server inspection in `operations/DEPLOYMENT.md` and
   shares the output (decides ADR-0008, ADR-0009).
3. Fix local tooling: Node on PATH; WSL distro with MySQL 8.4 and Redis/Valkey.
4. Phase 2 continued: search results, property page, tour page, checkout,
   account, and component states.
5. Phase 3: monorepo scaffold (backlog items 7–15 in the Phase 1 proposal).

## Blockers

| Blocker | Blocks | Owner |
| --- | --- | --- |
| RHEL version unknown | Node/MySQL/Redis version lock (ADR-0008/0009) | Owner: run inspection |
| Root password exposed in chat | Server security | Owner: rotate, disable root SSH |
| No flight supplier contract | Flights | Owner |
| No SSLCOMMERZ sandbox credentials | Payment integration (Phase 5) | Owner |
| Domain not chosen | TLS, email DNS | Owner |

## Known issues

- Node.js 26.13.0 is installed at `C:\Program Files\nodejs` but not on the
  shell PATH in VS Code (restart VS Code).
- MySQL, Redis/Valkey, GitHub CLI not installed locally; WSL has no distro.
- Python is not installed (only the Microsoft Store alias).
- Repository name contains the typo "truster" (owner may rename on GitHub).

## Latest validation results

| Check | Result |
| --- | --- |
| Prototype script syntax (`node --check`) | Passed |
| Six-season date mapping (7 sample dates) | Passed |
| Lint / typecheck / tests | Not applicable — no application code yet |
| Accessibility tooling (axe) | Not run — planned for Phase 2 component work |
| Lighthouse | Not run |

## Approvals required

- Design feedback on the homepage prototype.
- Permission for read-only SSH inspection (non-root key), or the owner runs it.
- Any push other than this initial documentation push.
