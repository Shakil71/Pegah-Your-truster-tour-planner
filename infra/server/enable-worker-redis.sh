#!/usr/bin/env bash
# Pegah — dedicated worker process and shared rate limits in Redis (ADR-0027).
# Run as root by the owner, after reading it:
#
#   sudo bash /home/pegah/pegah-infra/server/enable-worker-redis.sh
#
# Idempotent (re-running issues a new Redis password and restarts Pegah only).
#
# What it does (and nothing else):
#   1. Creates or resets a Redis ACL user "pegah" in the existing Redis 7, with
#      a random password, access ONLY to keys "pegah:*" and only the commands
#      Pegah needs. Other Redis users and data are not touched; redis.conf is
#      backed up before the ACL is persisted.
#   2. Proves the user can use pegah:* keys and is refused any other key.
#   3. Writes REDIS_URL, RUN_BACKGROUND_JOBS=false and the metrics ports to
#      /opt/pegah/shared/env/api.env (0600, owner pegah).
#   4. Installs pegah-worker.service and the deploy sudoers rule (validated
#      with visudo), starts the worker and restarts the API.
# It never prints passwords, never disables SELinux or firewalld, and opens no
# ports (Redis and metrics stay on 127.0.0.1).
set -euo pipefail

INFRA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE=/opt/pegah/shared/env/api.env
REDIS_CONF=/etc/redis/redis.conf
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

log() { printf '\n\033[1;33m==> %s\033[0m\n' "$*"; }
die() { printf '\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Run as root (sudo)."
[[ "$(getenforce)" == "Enforcing" ]] || die "SELinux must be Enforcing; this script will not change that."
[[ -f "$ENV_FILE" ]] || die "$ENV_FILE not found (is Pegah installed?)."
[[ -f /opt/pegah/current/apps/api/dist/worker.js ]] ||
  die "The deployed release has no worker.js yet; wait for the next deploy."
command -v redis-cli >/dev/null || die "redis-cli not found."
systemctl is-active --quiet redis || die "Redis is not running; this script does not start or install it."

# ── 1. Redis ACL user ────────────────────────────────────────────────────────
log "Redis ACL user 'pegah' (keys pegah:* only)"
admin_pass="$(awk '$1 == "requirepass" { print $2 }' "$REDIS_CONF" | tail -1)"
admin_pass="${admin_pass%\"}"
admin_pass="${admin_pass#\"}"
[[ -n "$admin_pass" ]] || die "No requirepass in $REDIS_CONF; cannot authenticate as the Redis admin."
# Passwords go through the environment, never the command line (ps, history).
admin() { REDISCLI_AUTH="$admin_pass" redis-cli --no-auth-warning -h "$REDIS_HOST" -p "$REDIS_PORT" "$@"; }
[[ "$(admin PING)" == "PONG" ]] || die "Cannot authenticate to Redis as the admin."

pegah_pass="$(openssl rand -hex 32)"
# Sent on stdin so the new password never appears in the process list.
printf 'ACL SETUSER pegah reset on >%s ~pegah:* resetchannels -@all +ping +info +select +client|setinfo +client|setname +get +set +del +exists +incr +expire +pexpire +ttl +pttl +eval +evalsha\n' \
  "$pegah_pass" | admin | grep -qx OK || die "ACL SETUSER failed."

aclfile="$(admin CONFIG GET aclfile | sed -n 2p)"
if [[ -n "$aclfile" ]]; then
  cp -a "$aclfile" "$aclfile.pegah-bak-$(date +%Y%m%d%H%M%S)"
  admin ACL SAVE >/dev/null
  echo "ACL saved to $aclfile (backup kept next to it)."
else
  cp -a "$REDIS_CONF" "$REDIS_CONF.pegah-bak-$(date +%Y%m%d%H%M%S)"
  admin CONFIG REWRITE >/dev/null
  echo "ACL persisted with CONFIG REWRITE (backup of redis.conf kept next to it)."
fi

# ── 2. Prove the restriction ─────────────────────────────────────────────────
log "Checking the pegah user's access"
as_pegah() { REDISCLI_AUTH="$pegah_pass" redis-cli --no-auth-warning --user pegah -h "$REDIS_HOST" -p "$REDIS_PORT" "$@"; }
[[ "$(as_pegah SET pegah:v1:setup-check ok EX 60)" == "OK" ]] || die "pegah user cannot write pegah:* keys."
as_pegah SET not-pegah-check x 2>&1 | grep -q NOPERM || die "pegah user can write keys outside pegah:* — refusing to continue."
as_pegah FLUSHALL 2>&1 | grep -q NOPERM || die "pegah user can run FLUSHALL — refusing to continue."
as_pegah DEL pegah:v1:setup-check >/dev/null
echo "OK: pegah:* allowed; other keys and dangerous commands refused."

# ── 3. Environment ───────────────────────────────────────────────────────────
log "Updating $ENV_FILE"
set_env() { # key value
  local tmp
  tmp="$(mktemp)"
  grep -v "^$1=" "$ENV_FILE" >"$tmp" || true
  printf '%s=%s\n' "$1" "$2" >>"$tmp"
  install -m 0600 -o pegah -g pegah "$tmp" "$ENV_FILE"
  rm -f "$tmp"
}
set_env REDIS_URL "redis://pegah:${pegah_pass}@${REDIS_HOST}:${REDIS_PORT}/0"
set_env RUN_BACKGROUND_JOBS false
set_env METRICS_PORT 9464
set_env WORKER_METRICS_PORT 9465
unset pegah_pass admin_pass
echo "REDIS_URL, RUN_BACKGROUND_JOBS, METRICS_PORT, WORKER_METRICS_PORT set."

# ── 4. Units and sudoers ─────────────────────────────────────────────────────
log "Installing pegah-worker.service and the deploy sudoers rule"
install -m 0644 "$INFRA_DIR/systemd/pegah-worker.service" /etc/systemd/system/pegah-worker.service
visudo -cf "$INFRA_DIR/sudoers/pegah-deploy" >/dev/null || die "sudoers file failed validation."
install -m 0440 "$INFRA_DIR/sudoers/pegah-deploy" /etc/sudoers.d/pegah-deploy
restorecon -F /etc/systemd/system/pegah-worker.service /etc/sudoers.d/pegah-deploy
systemctl daemon-reload
systemctl enable --now pegah-worker.service
systemctl restart pegah-worker.service pegah-api.service

log "Status"
sleep 5
systemctl is-active pegah-worker.service pegah-api.service
curl -fsS -o /dev/null http://127.0.0.1:4100/api/v1/health/ready && echo "API ready."
curl -fsS http://127.0.0.1:9465/metrics | grep -m1 '^pegah_bookings_held' || echo "(worker metrics not answering yet)"
echo "Done. The API no longer runs background jobs; pegah-worker does."
