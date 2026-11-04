#!/usr/bin/env bash
# Deploys one release tag to /opt/pegah. Runs as the `pegah` user.
#
#   /opt/pegah/bin/deploy.sh v0.3.0
#
# Steps: fresh clone of the tag → npm ci → build → prisma migrate deploy →
# seed:rbac → switch `current` → restart units → health checks. If health
# checks fail, `current` is switched back and the previous release restarted.
# Migrations are not rolled back, so they must be backward compatible
# (expand first, contract in a later release).
set -euo pipefail

TAG="${1:?usage: deploy.sh <tag>}"
REPO_URL="https://github.com/Shakil71/Pegah-Your-truster-tour-planner.git"
ROOT=/opt/pegah
ENV_DIR=$ROOT/shared/env
STATE=$ROOT/shared/state
KEEP_RELEASES=5
UNITS=(pegah-api.service pegah-web.service pegah-admin.service)

[[ "$(id -un)" == "pegah" ]] || { echo "Run as pegah" >&2; exit 1; }
[[ "$TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "Tag must look like v1.2.3" >&2; exit 1; }

exec 9>"$STATE/deploy.lock"
flock -n 9 || { echo "Another deploy is running" >&2; exit 1; }

log() { printf '[%s] %s\n' "$(date -u +%FT%TZ)" "$*"; }

RELEASE="$ROOT/releases/$(date -u +%Y%m%dT%H%M%SZ)-$TAG"
log "Cloning $TAG into $RELEASE"
git clone --quiet --depth 1 --branch "$TAG" "$REPO_URL" "$RELEASE"
SHA="$(git -C "$RELEASE" rev-parse HEAD)"
log "Commit $SHA"

cd "$RELEASE"
export NEXT_TELEMETRY_DISABLED=1 TURBO_TELEMETRY_DISABLED=1 NPM_CONFIG_FUND=false NPM_CONFIG_AUDIT=false
log "npm ci"
npm ci --no-progress
log "Build"
npx turbo run build --output-logs=errors-only

log "Database migrations"
(set -a; . "$ENV_DIR/migrate.env"; set +a; npm run --silent migrate:deploy -w @pegah/db)
log "RBAC seed (idempotent)"
(set -a; . "$ENV_DIR/api.env"; set +a; node apps/api/dist/cli/seed-rbac.js)

PREVIOUS="$(readlink -f "$ROOT/current" 2>/dev/null || true)"
switch_to() { ln -sfn "$1" "$ROOT/current.next" && mv -T "$ROOT/current.next" "$ROOT/current"; }
restart_all() { for u in "${UNITS[@]}"; do sudo -n /usr/bin/systemctl restart "$u"; done; }

check() { # url
  for _ in $(seq 1 30); do
    curl -fsS -o /dev/null --max-time 5 "$1" && return 0
    sleep 2
  done
  return 1
}

log "Switching current → $RELEASE"
switch_to "$RELEASE"
restart_all

if check http://127.0.0.1:4100/api/v1/health/ready &&
  check http://127.0.0.1:3100/ &&
  check http://127.0.0.1:3101/; then
  log "Healthy"
  echo "$TAG $SHA $(date -u +%FT%TZ)" >>"$STATE/deploy-history"
  echo "$TAG" >"$STATE/deployed-tag"
else
  log "Health checks FAILED — rolling back"
  if [[ -n "$PREVIOUS" && -d "$PREVIOUS" ]]; then
    switch_to "$PREVIOUS"
    restart_all
    log "Rolled back to $PREVIOUS"
  fi
  echo "$TAG" >>"$STATE/failed-tags"
  exit 1
fi

log "Pruning old releases (keeping $KEEP_RELEASES)"
CURRENT="$(readlink -f "$ROOT/current")"
ls -1dt "$ROOT"/releases/*/ | sed 's#/$##' | tail -n +$((KEEP_RELEASES + 1)) | while read -r old; do
  [[ "$old" == "$CURRENT" ]] || rm -rf -- "$old"
done
log "Deploy of $TAG complete"
