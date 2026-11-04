# Deployment (native RHEL)

Status: **planned**. The server has not been inspected or modified. No
deployment will happen without explicit owner approval.

## Target

| Item    | Value                                                           |
| ------- | --------------------------------------------------------------- |
| Host    | 192.168.197.100 (private address)                               |
| OS      | RHEL — exact release **unknown**                                |
| Access  | Non-root deploy user with SSH key (to be created by the owner)  |
| Runtime | Native Node.js under systemd; Nginx; MySQL 8.4; Redis or Valkey |

## Step 1 — read-only inspection (done 2026-11-04, as non-root `pegah`)

```bash
cat /etc/redhat-release; uname -r; nproc; free -h
df -h; lsblk; findmnt /databackup
ls -la /databackup; ls -laZ /databackup
systemctl list-units --type=service --state=running
ss -tlnp
rpm -qa | grep -Ei 'mysql|mariadb|redis|valkey|nginx|nodejs'
dnf module list nodejs mysql redis 2>/dev/null; dnf repolist
getenforce; firewall-cmd --list-all
```

Results (key-based SSH as `pegah`, no sudo; firewall rules and sshd config
were not readable without root):

| Item                | Finding                                                                                                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| OS                  | **Oracle Linux 9.8** (EL9, RHEL-compatible), UEK kernel 5.15                                                                                                                                     |
| Hardware            | 15 vCPU, 38 GiB RAM, VMware guest                                                                                                                                                                |
| Disks               | `/` 200 G (6 % used), `/var` 50 G, `/home` 20 G, `/tmp` 50 G; **`/databackup` = separate 50 G XFS partition (sda5), empty, root-owned**                                                          |
| SELinux / firewalld | Enforcing / active                                                                                                                                                                               |
| Node.js             | v22.23.2 (npm 10.9.8) already installed                                                                                                                                                          |
| Redis               | 7.2.16 running on 127.0.0.1:6379 (shared)                                                                                                                                                        |
| MySQL               | **Not installed**                                                                                                                                                                                |
| Web server          | nginx running (ports 80, 8090)                                                                                                                                                                   |
| Other tenants       | **Shared server:** another project (`Sellora-AI`) runs here with its own GitHub Actions runner service, PostgreSQL on 127.0.0.1:5432, an app on 127.0.0.1:3000 and something on **0.0.0.0:4000** |
| Other listeners     | 22, 111 (rpcbind), 9090 (Cockpit), 4330/44321 (PCP), 631 (CUPS, local)                                                                                                                           |
| Extras              | GNOME desktop (gdm) running; Podman installed (not used by Pegah)                                                                                                                                |

Consequences for Pegah:

- Ports 3000 and 4000 are taken. Pegah uses **web 127.0.0.1:3100, admin
  127.0.0.1:3101, API 127.0.0.1:4100** behind nginx.
- Redis is shared: Pegah gets its own ACL user and the `pg:` key prefix
  (never `FLUSHALL`; never touch other keys).
- MySQL 8.4 LTS must be installed (MySQL community EL9 repo or Oracle Linux
  AppStream, decided after `dnf` checks with sudo), with its datadir on
  `/databackup/mysql-data` and SELinux context `mysqld_db_t`. 50 G is ample
  for slice 1; backups should eventually go to a different disk or host,
  because a backup on the same physical disk does not survive disk loss.
- Pending owner actions: rotate the root password (exposed in chat twice),
  set `PermitRootLogin no` after confirming key access, lock or strengthen the
  `pegah` password (key login is used; password was shared in chat), review
  why something listens on 0.0.0.0:4000, consider disabling the GUI.

## Layout

```
/opt/pegah/releases/<UTC-timestamp>-<sha>/
/opt/pegah/current -> releases/<…>
/opt/pegah/shared/env/        web.env api.env worker.env   (0600, owner pegah)
/opt/pegah/shared/uploads/
/opt/pegah/scripts/
/var/log/pegah/
```

## Services

| Unit                 | Listens        | Notes            |
| -------------------- | -------------- | ---------------- |
| pegah-web.service    | 127.0.0.1:3100 | Next.js          |
| pegah-admin.service  | 127.0.0.1:3101 | Next.js          |
| pegah-api.service    | 127.0.0.1:4100 | NestJS           |
| pegah-worker.service | —              | BullMQ consumers |

Hardening: `User=pegah`, `NoNewPrivileges=yes`, `ProtectSystem=strict`,
`ReadWritePaths=/opt/pegah/shared/uploads /var/log/pegah`, `PrivateTmp=yes`.

## API service (Phase 3)

`/opt/pegah/shared/env/api.env` (0600, owner `pegah`) holds the variables
listed in `apps/api/.env.example`; production requires `COOKIE_SECURE=true`,
`OPENAPI_ENABLED=false`, `TRUST_PROXY_HOPS=1` (Nginx) and a
least-privilege MySQL user (SELECT/INSERT/UPDATE/DELETE on the app schema;
a separate migration user holds DDL rights).

```ini
# /etc/systemd/system/pegah-api.service (draft; install only with approval)
[Unit]
Description=Pegah API
After=network-online.target mysqld.service
Wants=network-online.target

[Service]
User=pegah
Group=pegah
WorkingDirectory=/opt/pegah/current/apps/api
EnvironmentFile=/opt/pegah/shared/env/api.env
ExecStart=/usr/bin/node dist/main.js
Restart=on-failure
RestartSec=5
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes
ReadWritePaths=/var/log/pegah

[Install]
WantedBy=multi-user.target
```

First-time database steps (each needs explicit approval on the server):

1. `npm run migrate:deploy -w @pegah/db` with the migration user's URL.
2. `npm run seed:rbac -w @pegah/api` (idempotent).
3. `npm run staff:create -w @pegah/api -- --email … --name "…" --role owner`
   (password from a hidden prompt; never on the command line).
4. Never run `seed:sample` in production (it refuses).

## Server setup (infra/, ADR-0016)

Everything that touches the server lives in `infra/`:

| Path                             | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `infra/server/bootstrap-root.sh` | One-time, idempotent root setup run by the owner: MySQL 8.4 LTS (official EL9 repo) with datadir `/databackup/mysql-data` (SELinux `mysqld_db_t`), 127.0.0.1 only, MySQL root via `auth_socket` (no password exists); DB users `pegah_migrate` (DDL), `pegah_app` (DML), `pegah_backup` (read); env files in `/opt/pegah/shared/env` (0600); systemd units; nginx site on :8180; firewalld 8180/tcp; SELinux port label; sudoers |
| `infra/systemd/`                 | `pegah-api` (4100), `pegah-web` (3100), `pegah-admin` (3101), `pegah-backup.timer` (03:00 Dhaka), `pegah-deploy-agent.timer` (every 2 min); all hardened (`ProtectSystem=strict`, `NoNewPrivileges`, …)                                                                                                                                                                                                                          |
| `infra/nginx/pegah.conf`         | :8180 → web, `/api/` → API. Admin is not exposed (SSH tunnel only) until it has a login screen                                                                                                                                                                                                                                                                                                                                   |
| `infra/sudoers/pegah-deploy`     | `pegah` may only `systemctl restart` the three Pegah units                                                                                                                                                                                                                                                                                                                                                                       |
| `infra/deploy/deploy.sh`         | Clone tag → `npm ci` → build → `prisma migrate deploy` → `seed:rbac` → switch `current` → restart → health checks → automatic rollback on failure; keeps 5 releases                                                                                                                                                                                                                                                              |
| `infra/deploy/deploy-agent.sh`   | Pull-based CD: deploys the newest `v*` tag once GitHub CI for that commit has succeeded                                                                                                                                                                                                                                                                                                                                          |
| `infra/backup/mysql-backup.sh`   | Nightly `mysqldump --single-transaction`, gzip + sha256, 14-day retention                                                                                                                                                                                                                                                                                                                                                        |

Owner runs once, after reading the script:

```bash
sudo bash /home/pegah/pegah-infra/server/bootstrap-root.sh
```

## Release procedure (CI/CD)

1. Work merges to `develop`, then `main`; GitHub Actions CI runs on every push
   (format, lint, typecheck, tests, build, OpenAPI drift).
2. **Approval = tag.** The owner (or Claude with the owner's explicit approval)
   pushes a semantic version tag on `main`, e.g. `v0.3.0`.
3. Within 2 minutes `pegah-deploy-agent` sees the tag, checks that the CI job
   for that exact commit succeeded, and runs `deploy.sh`. A failed CI marks the
   tag as rejected; it is never deployed.
4. Health checks: `/api/v1/health/ready`, web `/`, admin `/`. On failure the
   previous release is restored automatically.
5. History: `/opt/pegah/shared/state/deploy-history`; logs:
   `journalctl -u pegah-deploy-agent`.

Why pull-based (ADR-0016): the repository is public, so a self-hosted GitHub
runner on this server would let fork pull requests attempt to run code on it;
and the server sits on a private network GitHub cannot reach. The agent needs
no inbound access, no runner token and no GitHub credentials.

Manual deploy or redeploy: `/opt/pegah/bin/deploy.sh v0.3.0` as `pegah`.

## SELinux and firewall (require approval)

- `setsebool -P httpd_can_network_connect 1` for Nginx upstreams.
- File contexts for `/databackup/mysql-data` (`mysqld_db_t`).
- firewalld: open 80/443 only.
