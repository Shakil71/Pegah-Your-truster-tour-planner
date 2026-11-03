# Pegah Travel Platform

Pegah is a travel booking platform for Bangladesh: hotels, tours, flights and
visa services, priced in BDT, with an architecture ready for international
expansion.

> **Status:** Phase 2 (design). No application code exists yet.
> See [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md).

## What is here

| Path | Contents |
| --- | --- |
| [CLAUDE.md](CLAUDE.md) | Engineering rules for Claude Code and contributors |
| [docs/](docs/) | Requirements, architecture, database, API, design, security, testing and operations docs |
| [docs/design/prototype/](docs/design/prototype/) | Static homepage design prototype (Kantha direction) |

## Planned stack

Next.js · NestJS (Fastify) · MySQL 8.4 + Prisma · Redis + BullMQ ·
native RHEL with systemd and Nginx. No containers.
Details: [docs/architecture/SYSTEM_ARCHITECTURE.md](docs/architecture/SYSTEM_ARCHITECTURE.md).

## Viewing the design prototype

Open `docs/design/prototype/index.html` in a browser. It is a static design
reference, not the production application.

## Contributing

Read [CLAUDE.md](CLAUDE.md) first. Branch from `develop` as `feature/<name>`,
use Conventional Commits, and fill in the change-impact checklist in the pull
request template.

## License

Proprietary. All rights reserved. Destination photographs are third-party works
under their own licences; see [docs/design/IMAGE_CREDITS.md](docs/design/IMAGE_CREDITS.md).
