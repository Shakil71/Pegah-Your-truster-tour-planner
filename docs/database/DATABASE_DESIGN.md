# Database Design

Status: **planned**. No schema or migrations exist yet.

## Engine and conventions

- MySQL 8.4 LTS, InnoDB, `utf8mb4` / `utf8mb4_0900_ai_ci`.
- Prisma migrations; production uses `prisma migrate deploy` only.
- Primary keys: `BIGINT UNSIGNED AUTO_INCREMENT` internally, plus a public
  `CHAR(26)` ULID where an ID is exposed in URLs or to customers.
- Money: `BIGINT` minor units + `CHAR(3)` currency (ADR-0004).
- Timestamps: `DATETIME(3)` in UTC; `created_at`, `updated_at` on every table.
- Foreign keys everywhere; `ON DELETE RESTRICT` by default for financial data.

## Slice 1 tables (to be designed in detail in Phase 3)

| Domain | Tables |
| --- | --- |
| Identity | users, roles, permissions, role_permissions, user_roles, sessions |
| Travellers | traveler_profiles (passport fields encrypted at application level) |
| Catalog | destinations, hotels, hotel_rooms, tours, tour_schedules, media_assets |
| Inventory | room_inventory (room_id, date, total, held, sold), room_rates, tour_capacity |
| Booking | bookings, booking_items, booking_guests, inventory_holds, booking_status_history |
| Money | payments, payment_events, refunds, invoices |
| Reliability | idempotency_keys, outbox_events |
| Audit | audit_events |

## Booking lifecycle

```
DRAFT → PENDING_AVAILABILITY → PENDING_PAYMENT → PAYMENT_PROCESSING → CONFIRMED → COMPLETED
PENDING_AVAILABILITY → FAILED
PENDING_PAYMENT → EXPIRED
PAYMENT_PROCESSING → FAILED | MANUAL_REVIEW
MANUAL_REVIEW → CONFIRMED | REFUND_PENDING
CONFIRMED → CANCELLATION_REQUESTED → CANCELLED → REFUND_PENDING → REFUNDED
```

## Concurrency and integrity rules

- Holds lock `room_inventory` rows with `SELECT … FOR UPDATE`, update `held`, and
  enforce `held + sold <= total` with a CHECK constraint.
- Unique `(provider, provider_event_id)` on `payment_events` blocks duplicate webhooks.
- Unique `(actor_id, idempotency_key, route)` on `idempotency_keys`.
- No transaction spans an external call; the outbox carries follow-up work.

## Storage on the server

| Purpose | Path |
| --- | --- |
| Live data directory | `/databackup/mysql-data` |
| Backups | `/databackup/mysql-backups` |
| Restore staging | `/databackup/restore-staging` |

Configuring a non-default datadir requires the inspection and approval steps in
`docs/operations/DEPLOYMENT.md` and SELinux file contexts (`mysqld_db_t`).
Never delete or overwrite existing database files.
