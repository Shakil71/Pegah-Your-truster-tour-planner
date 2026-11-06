# Deploying Pegah on cPanel shared hosting

Status: prepared, not yet tried on the real host (ADR-0040). The first deploy
is done together, step by step; anything the host does differently is fixed
here afterwards.

The RHEL server (`DEPLOYMENT.md`) remains the reference setup. cPanel shared
hosting runs the same code with these differences:

| Topic           | RHEL server                 | cPanel shared hosting                                 |
| --------------- | --------------------------- | ----------------------------------------------------- |
| Processes       | systemd units               | three "Setup Node.js App" apps (Passenger)            |
| Background jobs | `pegah-worker` process      | cron every minute: `dist/cli/run-jobs.js`             |
| Database        | MySQL 8.4                   | the host's MariaDB (tested in CI on MariaDB 11.4)     |
| Rate limits     | Redis, shared               | in memory, per app process                            |
| Build           | on the server (`deploy.sh`) | GitHub Actions builds `pegah-cpanel-<sha>.tar.gz`     |
| TLS             | Nginx                       | cPanel AutoSSL (Let's Encrypt)                        |
| Backups         | nightly `mysql-backup.sh`   | cPanel backups + a manual download before each update |

## What you need

- cPanel with **Setup Node.js App** offering **Node.js 22** (or newer), SSH
  (Terminal) access, MySQL Databases, Cron Jobs and SSL/TLS (AutoSSL).
- Access to the DNS for `pegah.com.bd` at your DNS provider.
- The bundle: GitHub → Actions → **cPanel bundle** → latest run on `main` →
  Artifacts → `pegah-cpanel-…` (or **Run workflow** with your site address).

## 1. DNS and certificate

1. In cPanel → **Domains**, add `pegah.com.bd` (if it is not the main domain).
   Note the server IP shown in cPanel (General Information → Shared IP).
2. At your DNS provider: `A` record `pegah.com.bd` → that IP, and `www` (CNAME
   to `pegah.com.bd`). Wait until `ping pegah.com.bd` shows the cPanel IP.
3. cPanel → **SSL/TLS Status** → Run AutoSSL. Continue only when
   `https://pegah.com.bd` shows a valid certificate.

## 2. Database

1. cPanel → **MySQL Databases**: create database `<user>_pegah` and user
   `<user>_pegah` with a long random password (password manager). Add the user
   to the database with **ALL PRIVILEGES** (migrations need DDL).
2. Note the URL (keep it secret):
   `mysql://<user>_pegah:<password>@localhost:3306/<user>_pegah`
   If the password has special characters, URL-encode them.

## 3. Upload the bundle

1. cPanel → **File Manager**: upload `pegah-cpanel-<sha>.tar.gz` to your home
   folder (not `public_html`), then **Extract**. You get `~/pegah/{api,web,admin,migrate}`.
2. Create `~/pegah/logs`.

## 4. Migrations (SSH / Terminal)

```bash
cd ~/pegah/migrate
source <the "Enter to the virtual environment" command shown for the API app, or any Node 22 app>
npm install --omit=dev
DATABASE_URL='mysql://…' npx prisma migrate deploy
```

Expected: `All migrations have been successfully applied.`

## 5. The three Node.js apps

cPanel → **Setup Node.js App** → **Create Application**, three times:

| App     | Node.js | Mode       | Application root | Application URL      | Startup file   |
| ------- | ------- | ---------- | ---------------- | -------------------- | -------------- |
| API     | 22.x    | Production | `pegah/api`      | `pegah.com.bd/api`   | `dist/main.js` |
| Console | 22.x    | Production | `pegah/admin`    | `pegah.com.bd/admin` | `server.js`    |
| Website | 22.x    | Production | `pegah/web`      | `pegah.com.bd`       | `server.js`    |

Create the API first, then the Console, then the Website. Do **not** press
"Run NPM Install" (the bundle already contains everything).

Environment variables (Setup Node.js App → the app → Add Variable):

**API**

| Name                      | Value                                                        |
| ------------------------- | ------------------------------------------------------------ |
| `NODE_ENV`                | `production`                                                 |
| `DATABASE_URL`            | the URL from step 2                                          |
| `SESSION_SECRET`          | 64 random characters (`openssl rand -base64 48` in Terminal) |
| `APP_ORIGINS`             | `https://pegah.com.bd,https://www.pegah.com.bd`              |
| `COOKIE_SECURE`           | `true`                                                       |
| `TRUST_PROXY_HOPS`        | `1`                                                          |
| `PUBLIC_BASE_URL`         | `https://pegah.com.bd`                                       |
| `MEDIA_BASE_URL`          | `/media`                                                     |
| `RUN_BACKGROUND_JOBS`     | `false` (cron runs them, step 7)                             |
| `OPENAPI_ENABLED`         | `false`                                                      |
| `SETTINGS_ENCRYPTION_KEY` | `openssl rand -base64 32` (new key; keep a copy)             |
| `DOCUMENT_ENCRYPTION_KEY` | `openssl rand -base64 32` (another new key; keep a copy)     |

**Website** and **Console**: `NODE_ENV=production`,
`NEXT_TELEMETRY_DISABLED=1`, `API_INTERNAL_URL=https://pegah.com.bd`.

Restart each app after changing variables.

## 6. First data

In Terminal (inside the API app's virtual environment, with the same
variables exported as the API app — copy them from the app page):

```bash
cd ~/pegah/api
node dist/cli/seed-rbac.js                  # roles and permissions
node dist/cli/create-staff.js --email you@example.com --name "Owner" --role owner
```

Then sign in at `https://pegah.com.bd/admin`. For the old website's data,
follow `LEGACY_IMPORT.md` with these paths (`~/pegah/api`, your DATABASE_URL).

## 7. Background jobs (cron)

cPanel → **Cron Jobs** → every minute (`* * * * *`):

```
cd ~/pegah/api && /home/<user>/nodevenv/pegah/api/22/bin/node dist/cli/run-jobs.js >> ~/pegah/logs/jobs.log 2>&1
```

Use the node path shown on the API app page. The cron entry needs the API
variables too: cPanel cron does not read the app's variables, so put them in
`~/pegah/api/.env.cron` (mode 600, outside `public_html`) and start the line
with `set -a; . ~/pegah/api/.env.cron; set +a;`. This file holds secrets: never
share it and never put it under `public_html`.

`jobs.log` should show a line per minute: holds expired, orders expired,
events sent, documents purged.

## 8. Check

- `https://pegah.com.bd/api/v1/health/ready` → `"database":"up"`.
- Home page, a hotel page with photos, `/visa`, `/flights`, `/admin` sign-in.
- Book a demo hold (if demo data is loaded) and see it expire after 15 minutes
  (proves the cron job works).

## Updating

1. Download the database (cPanel → Backup → MySQL database) and keep it.
2. Upload and extract the new bundle over `~/pegah` (keep `logs`, `.env.cron`).
3. Run step 4 (migrations), then **Restart** the three apps.

## If something goes wrong

- App shows "Incomplete response" / 503: open `~/pegah/<app>/stderr.log` (the
  Node.js app writes it there) and send the last lines to Claude (remove any
  passwords first).
- `argon2` or `sharp` fails to load: in the API's virtual environment run
  `cd ~/pegah/api && npm rebuild argon2 sharp`.
- `/admin` shows the website's 404: the Console app's URL must be exactly
  `pegah.com.bd/admin`.
- Uploads over 1–2 MB fail: ask the host for a higher request body limit, or
  upload smaller scans (photos are compressed in the browser automatically).
