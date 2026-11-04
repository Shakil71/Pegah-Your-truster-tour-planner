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

## Release procedure (planned)

1. CI builds a release tarball on a tag.
2. Manual approval on the protected `production` environment.
3. Upload to a new `releases/` directory; run `prisma migrate deploy`.
4. Switch the `current` symlink; restart Pegah units only.
5. Health check `/api/v1/health/ready` and the homepage.
6. On failure, switch the symlink back and restart.

## SELinux and firewall (require approval)

- `setsebool -P httpd_can_network_connect 1` for Nginx upstreams.
- File contexts for `/databackup/mysql-data` (`mysqld_db_t`).
- firewalld: open 80/443 only.
