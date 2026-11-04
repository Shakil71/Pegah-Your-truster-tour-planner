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

## Step 1 — read-only inspection (not yet done)

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

Record the output here before planning any installation.

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
| pegah-web.service    | 127.0.0.1:3000 | Next.js          |
| pegah-admin.service  | 127.0.0.1:3001 | Next.js          |
| pegah-api.service    | 127.0.0.1:4000 | NestJS           |
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
