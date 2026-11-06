# Importing the old Pegah website

The previous website (Laravel, MariaDB) is imported once into the new database
(ADR-0038). The importer is additive and repeatable; it never edits or deletes
existing rows.

## Inputs

| Input         | What                                                       | Where it lives                          |
| ------------- | ---------------------------------------------------------- | --------------------------------------- |
| Database dump | phpMyAdmin export of `pegaoafz_db` (the newest of the two) | Outside the repository; never committed |
| Images folder | The old site's `public/images` (hotel, room, tour, icon…)  | Outside the repository; never committed |

`pegaoafz_pegah_db` is an older copy of the same database: every row in it is
also in `pegaoafz_db` (6 rows were updated later), so only the newer dump is
imported.

The dump contains customer personal data and password hashes. Keep it off
shared drives, never commit it, and delete server copies after the import.

## What goes where

| Old data                                      | New place                                                                                            |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| cities, tour cities, tourist spots            | `destinations` (existing slugs such as `coxs-bazar` are reused, never overwritten)                   |
| hotels (+ images, facilities, nearby places)  | `hotels` **DRAFT**, `hotel_media`, `hotel_amenities`, new hotel columns                              |
| hotel rooms (+ images, facilities)            | `hotel_rooms`, `room_media`, `room_amenities`; old prices in `rack_rate_minor`/`discount_rate_minor` |
| tours (+ images, facilities, tags, vehicles)  | `tours` **DRAFT**, `tour_media`, `tour_amenities`, new tour columns                                  |
| packages (Umrah, corporate)                   | `offers` **DRAFT** (`offer_media`); Bangla fields hold the English text until translated             |
| users with an email                           | `users` (customers). Old bcrypt password works once, then is upgraded to Argon2id                    |
| coupons                                       | `promotions` **PAUSED**                                                                              |
| privacy policy, terms, about                  | `content_pages` **DRAFT** (`-old-website` suffix when the slug is taken)                             |
| everything (bookings, messages, subscribers…) | `legacy_records`: every row verbatim; Console → System → Old website data                            |

Not imported: `sessions`, `otp_sent_mobiles`, `password_resets`, `jobs`,
`failed_jobs`, `migrations`. Never copied into the archive: `password`,
`remember_token`, `session_id`, `otp_code`, `national_id`,
`passport_number` fields.

No room rates, inventory or tour departures are created: the old prices are
from 2022–2024. Staff set real rates in the calendar, review photos (the
supplier must have allowed their use) and text, then publish.

## Steps (server; owner approval required)

1. Back up the database and check the file (server, as your admin user):

   ```bash
   sudo systemctl start pegah-backup.service
   sudo ls -lh /databackup/mysql-backups | tail -3
   ```

2. Copy the dump and the images folder from the Windows PC (PowerShell):

   ```powershell
   ssh <you>@192.168.197.100 "mkdir -p /tmp/pegah-legacy && chmod 700 /tmp/pegah-legacy"
   scp "D:\Github Code\pegaoafz_db.sql" <you>@192.168.197.100:/tmp/pegah-legacy/
   scp -r "D:\Github Code\images" <you>@192.168.197.100:/tmp/pegah-legacy/
   ```

   Then on the server hand them to the service user:

   ```bash
   sudo mkdir -p /opt/pegah/shared/legacy
   sudo mv /tmp/pegah-legacy/* /opt/pegah/shared/legacy/
   sudo chown -R pegah:pegah /opt/pegah/shared/legacy && sudo chmod -R go-rwx /opt/pegah/shared/legacy
   ```

3. Dry run — checks everything, writes nothing:

   ```bash
   sudo -u pegah bash -c 'cd /opt/pegah/current && set -a && . /opt/pegah/shared/env/api.env && set +a &&
     node apps/api/dist/cli/import-legacy.js --dump /opt/pegah/shared/legacy/pegaoafz_db.sql \
       --images /opt/pegah/shared/legacy/images --dry-run'
   ```

4. Import: the same command with `--confirm-production` instead of `--dry-run`.
5. Verify — every source row and field is present and unchanged:

   ```bash
   sudo -u pegah bash -c 'cd /opt/pegah/current/apps/api && set -a && . /opt/pegah/shared/env/api.env && set +a &&
     node scripts/verify-legacy-import.mjs /opt/pegah/shared/legacy/pegaoafz_db.sql'
   ```

   Expected: `OK: nothing missing, nothing changed.`

6. Delete the copies: `sudo rm -rf /opt/pegah/shared/legacy /tmp/pegah-legacy`.

Running the import again is safe: rows already in `legacy_records` are skipped.

## Results of the local rehearsal (2026-11-06)

45 hotels, 169 rooms (4 rooms belonged to hotels deleted on the old site and
stay in the archive), 16 tours, 8 packages, 19 destinations, 67 amenities,
15 customers (2 old accounts without an email stay in the archive), 2 coupons,
3 pages, 821 photos (708 stored, 113 duplicates; 10 referenced files were not
in the folder) and 7,868 archive rows. The verifier compared 56,277 fields:
nothing missing, nothing changed. A second run added nothing.
