#!/usr/bin/env bash
# Pegah — one-time server bootstrap. Run as root by the owner, after reading it:
#
#   sudo bash /home/pegah/pegah-infra/server/bootstrap-root.sh
#
# Idempotent: safe to run again. It never touches other tenants' services,
# nginx sites, databases or Redis. It never stores or asks for a root password.
#
# What it does:
#   1. Directories under /opt/pegah and /databackup.
#   2. MySQL 8.4 LTS from the official MySQL EL9 repository, datadir on
#      /databackup/mysql-data (SELinux mysqld_db_t), bound to 127.0.0.1 only;
#      MySQL root uses auth_socket (no password exists at all).
#   3. Database `pegah` with three least-privilege users; random passwords are
#      written only to 0600 env files owned by `pegah`.
#   4. systemd units (api, web, admin, backup timer, deploy agent timer).
#   5. nginx site on port 8180 (public site + /api); admin stays on localhost.
#   6. firewalld: open 8180/tcp. SELinux: label 8180 as http_port_t.
#   7. sudoers: `pegah` may restart only the Pegah units.
set -euo pipefail

INFRA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_USER=pegah
PUBLIC_PORT=8180
MYSQL_RELEASE_RPM="https://repo.mysql.com/mysql84-community-release-el9-4.noarch.rpm"
DATADIR=/databackup/mysql-data
ENV_DIR=/opt/pegah/shared/env

log() { printf '\n\033[1;33m==> %s\033[0m\n' "$*"; }
die() { printf '\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Run as root (sudo)."
id "$APP_USER" >/dev/null 2>&1 || die "User $APP_USER does not exist."
[[ "$(getenforce)" == "Enforcing" ]] || die "SELinux must be Enforcing; this script will not change that."
mountpoint -q /databackup || die "/databackup is not a mounted filesystem."

rand() { openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c "${1:-32}"; }

# ── 1. Directories ────────────────────────────────────────────────────────────
log "Directories"
install -d -m 0750 -o "$APP_USER" -g "$APP_USER" /opt/pegah /opt/pegah/releases /opt/pegah/shared
install -d -m 0700 -o "$APP_USER" -g "$APP_USER" "$ENV_DIR"
install -d -m 0750 -o "$APP_USER" -g "$APP_USER" /opt/pegah/shared/uploads /opt/pegah/shared/state
install -d -m 0700 -o "$APP_USER" -g "$APP_USER" /databackup/mysql-backups /databackup/restore-staging
usermod -aG systemd-journal "$APP_USER"   # read its own service logs

# ── 2. MySQL 8.4 LTS ──────────────────────────────────────────────────────────
log "MySQL 8.4 packages"
dnf -y install policycoreutils-python-utils openssl >/dev/null
if ! rpm -q mysql84-community-release >/dev/null 2>&1; then
  dnf -y install "$MYSQL_RELEASE_RPM"
fi
# The distribution's MySQL 8.0 module must not shadow the community packages.
dnf -y module disable mysql >/dev/null 2>&1 || true
if ! rpm -q mysql-community-server >/dev/null 2>&1; then
  dnf -y install mysql-community-server
fi
mysqld --version

log "MySQL datadir on $DATADIR (SELinux mysqld_db_t)"
semanage fcontext -l | grep -qF "${DATADIR}(/.*)?" ||
  semanage fcontext -a -t mysqld_db_t "${DATADIR}(/.*)?"
install -d -m 0750 -o mysql -g mysql "$DATADIR"
restorecon -R "$DATADIR"

if [[ ! -f /etc/my.cnf.pegah-orig ]]; then cp -a /etc/my.cnf /etc/my.cnf.pegah-orig; fi
cat >/etc/my.cnf <<'CNF'
# Managed by Pegah bootstrap. Original kept at /etc/my.cnf.pegah-orig.
[mysqld]
datadir=/databackup/mysql-data
socket=/var/lib/mysql/mysql.sock
log-error=/var/log/mysqld.log
pid-file=/var/run/mysqld/mysqld.pid
bind-address=127.0.0.1
mysqlx=OFF
character-set-server=utf8mb4
collation-server=utf8mb4_unicode_ci
default-time-zone='+00:00'
innodb_buffer_pool_size=4G
max_connections=200
local_infile=OFF

[client]
socket=/var/lib/mysql/mysql.sock
CNF

if [[ ! -d "$DATADIR/mysql" ]]; then
  log "Initialising MySQL data directory"
  mysqld --defaults-file=/etc/my.cnf --initialize-insecure --user=mysql
  restorecon -R "$DATADIR"
  systemctl enable --now mysqld
  # Root gets socket authentication: only the OS root user can log in, and no
  # MySQL root password exists anywhere.
  mysql -uroot <<'SQL'
INSTALL PLUGIN auth_socket SONAME 'auth_socket.so';
ALTER USER 'root'@'localhost' IDENTIFIED WITH auth_socket;
DELETE FROM mysql.user WHERE user = '';
FLUSH PRIVILEGES;
SQL
else
  systemctl enable --now mysqld
fi
mysql -uroot -e "SELECT VERSION() AS mysql_version, @@datadir AS datadir, @@bind_address AS bind;"

# ── 3. Database and users ─────────────────────────────────────────────────────
log "Database and least-privilege users"
mysql -uroot -e "CREATE DATABASE IF NOT EXISTS pegah CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

ensure_user() { # name host password grants...
  local name=$1 password=$2 grants=$3
  if [[ -z "$(mysql -uroot -N -e "SELECT 1 FROM mysql.user WHERE user='${name}' AND host='127.0.0.1'")" ]]; then
    mysql -uroot -e "CREATE USER '${name}'@'127.0.0.1' IDENTIFIED BY '${password}';"
    echo "created ${name}"
  else
    mysql -uroot -e "ALTER USER '${name}'@'127.0.0.1' IDENTIFIED BY '${password}';"
    echo "updated ${name} password"
  fi
  mysql -uroot -e "${grants}"
}

write_env() { # file content — only if the file does not exist yet
  local file=$1
  if [[ ! -f "$file" ]]; then
    umask 077
    cat >"$file"
    chown "$APP_USER:$APP_USER" "$file"
    chmod 0600 "$file"
    echo "wrote $file"
  else
    cat >/dev/null
    echo "kept existing $file"
  fi
}

# Reuse existing passwords on re-runs; otherwise generate new ones.
existing() { [[ -f "$1" ]] && sed -nE "s#^${2}=mysql://[^:]+:([^@]+)@.*#\1#p" "$1" | head -1; }
MIGRATE_PW="$(existing "$ENV_DIR/migrate.env" DATABASE_URL)"; MIGRATE_PW="${MIGRATE_PW:-$(rand 32)}"
APP_PW="$(existing "$ENV_DIR/api.env" DATABASE_URL)"; APP_PW="${APP_PW:-$(rand 32)}"
BACKUP_PW="$( [[ -f "$ENV_DIR/backup.cnf" ]] && sed -nE 's/^password=(.*)/\1/p' "$ENV_DIR/backup.cnf" )"; BACKUP_PW="${BACKUP_PW:-$(rand 32)}"

ensure_user pegah_migrate "$MIGRATE_PW" \
  "GRANT ALL PRIVILEGES ON pegah.* TO 'pegah_migrate'@'127.0.0.1';"
ensure_user pegah_app "$APP_PW" \
  "GRANT SELECT, INSERT, UPDATE, DELETE ON pegah.* TO 'pegah_app'@'127.0.0.1';"
ensure_user pegah_backup "$BACKUP_PW" \
  "GRANT SELECT, SHOW VIEW, TRIGGER, LOCK TABLES ON pegah.* TO 'pegah_backup'@'127.0.0.1';"
mysql -uroot -e "FLUSH PRIVILEGES;"

DB_PARAMS="allowPublicKeyRetrieval=true"
write_env "$ENV_DIR/migrate.env" <<EOF
DATABASE_URL=mysql://pegah_migrate:${MIGRATE_PW}@127.0.0.1:3306/pegah?${DB_PARAMS}
EOF

write_env "$ENV_DIR/api.env" <<EOF
NODE_ENV=production
HOST=127.0.0.1
PORT=4100
LOG_LEVEL=info
DATABASE_URL=mysql://pegah_app:${APP_PW}@127.0.0.1:3306/pegah?${DB_PARAMS}
SESSION_SECRET=$(rand 64)
APP_ORIGINS=http://192.168.197.100:${PUBLIC_PORT},http://27.147.147.228:${PUBLIC_PORT}
COOKIE_SECURE=true
TRUST_PROXY_HOPS=1
OPENAPI_ENABLED=false
MEDIA_BASE_URL=/media
EOF

write_env "$ENV_DIR/web.env" <<EOF
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
EOF

write_env "$ENV_DIR/backup.cnf" <<EOF
[client]
user=pegah_backup
password=${BACKUP_PW}
host=127.0.0.1
port=3306
EOF

# ── 4. systemd units ──────────────────────────────────────────────────────────
log "systemd units"
install -m 0644 "$INFRA_DIR"/systemd/pegah-*.service "$INFRA_DIR"/systemd/pegah-*.timer /etc/systemd/system/
install -d -m 0755 /opt/pegah/bin
install -m 0755 "$INFRA_DIR/deploy/deploy.sh" "$INFRA_DIR/deploy/deploy-agent.sh" \
  "$INFRA_DIR/backup/mysql-backup.sh" /opt/pegah/bin/
systemctl daemon-reload
# App units start on the first deploy (no release exists yet).
systemctl enable pegah-api.service pegah-web.service pegah-admin.service >/dev/null
systemctl enable --now pegah-backup.timer pegah-deploy-agent.timer

# ── 5–6. nginx, SELinux port, firewalld ───────────────────────────────────────
log "nginx site on :$PUBLIC_PORT"
if ! semanage port -l | grep -E "^http_port_t\s" | grep -qw "$PUBLIC_PORT"; then
  semanage port -a -t http_port_t -p tcp "$PUBLIC_PORT" 2>/dev/null ||
    semanage port -m -t http_port_t -p tcp "$PUBLIC_PORT"
fi
install -m 0644 "$INFRA_DIR/nginx/pegah.conf" /etc/nginx/conf.d/pegah.conf
# Never leave a broken config behind: other sites share this nginx.
if ! nginx -t; then
  rm -f /etc/nginx/conf.d/pegah.conf
  die "nginx config test failed; pegah.conf removed, nginx untouched."
fi
systemctl reload nginx

log "firewalld"
firewall-cmd --permanent --add-port="${PUBLIC_PORT}/tcp" >/dev/null
firewall-cmd --reload >/dev/null
firewall-cmd --list-ports

# ── 7. sudoers ────────────────────────────────────────────────────────────────
log "sudoers (restart Pegah units only)"
install -m 0440 "$INFRA_DIR/sudoers/pegah-deploy" /etc/sudoers.d/pegah-deploy
visudo -cf /etc/sudoers.d/pegah-deploy

log "Done"
cat <<MSG
MySQL 8.4 is running on 127.0.0.1:3306 with data in $DATADIR.
Secrets are in $ENV_DIR (0600, owner $APP_USER); nothing secret was printed.
The site will answer on http://<server>:$PUBLIC_PORT after the first deploy.
Deploys happen when a v* tag is pushed and its CI run succeeded.
MSG
