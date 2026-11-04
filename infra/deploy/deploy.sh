#!/usr/bin/env bash
# Deploys one commit to /opt/pegah. Runs as the `pegah` user.
#
#   /opt/pegah/bin/deploy.sh <40-char commit sha | vX.Y.Z tag>
#
# Steps: fetch that exact commit → npm ci → build (with build stamp) →
# prisma migrate deploy → seed:rbac → switch `current` → restart units →
# health checks → self-update the deploy tools. If health checks fail,
# `current` is switched back and the previous release restarted.
# Migrations are not rolled back, so they must be backward compatible
# (expand first, contract in a later release).
set -euo pipefail

REF="${1:?usage: deploy.sh <commit-sha|vX.Y.Z>}"
REPO_URL="https://github.com/Shakil71/Pegah-Your-truster-tour-planner.git"
ROOT=/opt/pegah
ENV_DIR=$ROOT/shared/env
STATE=$ROOT/shared/state
KEEP_RELEASES=5
UNITS=(pegah-api.service pegah-web.service pegah-admin.service)

[[ "$(id -un)" == "pegah" ]] || { echo "Run as pegah" >&2; exit 1; }
[[ "$REF" =~ ^([0-9a-f]{40}|v[0-9]+\.[0-9]+\.[0-9]+)$ ]] ||
  { echo "Ref must be a full commit sha or a vX.Y.Z tag" >&2; exit 1; }

exec 9>"$STATE/deploy.lock"
flock -n 9 || { echo "Another deploy is running" >&2; exit 1; }

log() { printf '[%s] %s\n' "$(date -u +%FT%TZ)" "$*"; }
STARTED=$(date +%s)

RELEASE="$ROOT/releases/$(date -u +%Y%m%dT%H%M%SZ)-${REF:0:12}"
log "Fetching $REF into $RELEASE"
git init --quiet "$RELEASE"
git -C "$RELEASE" fetch --quiet --depth 1 "$REPO_URL" "$REF"
git -C "$RELEASE" checkout --quiet FETCH_HEAD
SHA="$(git -C "$RELEASE" rev-parse HEAD)"
SUBJECT="$(git -C "$RELEASE" log -1 --format=%s)"
log "Commit $SHA — $SUBJECT"

# ── GitHub Deployments (optional) ─────────────────────────────────────────────
# With a fine-grained token (this repo only, "Deployments: read and write")
# in $ENV_DIR/github.env as GITHUB_DEPLOY_TOKEN=..., every deploy shows up in
# GitHub under Deployments → production. Without it, deploys work the same.
# The token is never printed.
REPO_API="https://api.github.com/repos/Shakil71/Pegah-Your-truster-tour-planner"
SITE_URL="https://27.147.147.228:8443"
GITHUB_DEPLOY_TOKEN=""
[[ -r "$ENV_DIR/github.env" ]] &&
  GITHUB_DEPLOY_TOKEN="$(sed -nE 's/^GITHUB_DEPLOY_TOKEN=(.+)$/\1/p' "$ENV_DIR/github.env")"
DEPLOYMENT_ID=""
gh_post() { # path json → prints response; never fails the deploy
  [[ -n "$GITHUB_DEPLOY_TOKEN" ]] || return 0
  curl -fsS --max-time 15 -X POST \
    -H "Authorization: Bearer $GITHUB_DEPLOY_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    "$REPO_API/$1" -d "$2" 2>/dev/null || true
}
gh_status() { # state description
  [[ -n "$DEPLOYMENT_ID" ]] || return 0
  gh_post "deployments/$DEPLOYMENT_ID/statuses" \
    "{\"state\":\"$1\",\"description\":\"$2\",\"environment\":\"production\",\"environment_url\":\"$SITE_URL\",\"auto_inactive\":true}" >/dev/null
}
DEPLOYMENT_ID="$(gh_post deployments \
  "{\"ref\":\"$SHA\",\"environment\":\"production\",\"auto_merge\":false,\"required_contexts\":[],\"description\":\"Pull-based deploy on the Pegah server\"}" |
  node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).id??"")}catch{console.log("")}})')"
gh_status in_progress "Building ${SHA:0:7} on the server"
# Any failure from here on is reported to GitHub before the script exits.
trap 'code=$?; [[ $code -eq 0 ]] || gh_status failure "Deploy failed (exit $code); previous release kept"' EXIT

cd "$RELEASE"
BUILT_AT="$(date -u +%FT%TZ)"
printf '{"commit":"%s","builtAt":"%s","ref":"%s"}\n' "$SHA" "$BUILT_AT" "$REF" >build-info.json
export NEXT_TELEMETRY_DISABLED=1 TURBO_TELEMETRY_DISABLED=1 NPM_CONFIG_FUND=false NPM_CONFIG_AUDIT=false
export NEXT_PUBLIC_BUILD_SHA="$SHA" NEXT_PUBLIC_BUILD_TIME="$BUILT_AT"
log "npm ci"
npm ci --no-progress
log "Build"
npx turbo run build --output-logs=errors-only

log "Database migrations"
(set -a; . "$ENV_DIR/migrate.env"; set +a; npm run --silent migrate:deploy -w @pegah/db)
log "RBAC seed (idempotent)"
(set -a; . "$ENV_DIR/api.env"; set +a; node apps/api/dist/cli/seed-rbac.js)
log "Content page drafts (idempotent; never publishes)"
(set -a; . "$ENV_DIR/api.env"; set +a; node apps/api/dist/cli/seed-content.js)

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
  check http://127.0.0.1:3101/admin; then
  log "Healthy"
  gh_status success "Live: ${SHA:0:7} $(printf '%s' "$SUBJECT" | tr -d '"\\' | cut -c1-80)"
  echo "$SHA $REF $BUILT_AT $(( $(date +%s) - STARTED ))s $SUBJECT" >>"$STATE/deploy-history"
  echo "$SHA" >"$STATE/deployed-sha"
else
  log "Health checks FAILED — rolling back"
  if [[ -n "$PREVIOUS" && -d "$PREVIOUS" ]]; then
    switch_to "$PREVIOUS"
    restart_all
    log "Rolled back to $PREVIOUS"
  fi
  echo "$SHA" >>"$STATE/failed-shas"
  exit 1
fi

# The deploy tools ship with the release, so CI/CD changes deploy themselves.
log "Updating deploy tools in $ROOT/bin"
for f in infra/deploy/deploy.sh infra/deploy/deploy-agent.sh infra/backup/mysql-backup.sh; do
  install -m 0755 "$f" "$ROOT/bin/.$(basename "$f").new"
  mv -f "$ROOT/bin/.$(basename "$f").new" "$ROOT/bin/$(basename "$f")"
done

log "Pruning old releases (keeping $KEEP_RELEASES)"
CURRENT="$(readlink -f "$ROOT/current")"
ls -1dt "$ROOT"/releases/*/ | sed 's#/$##' | tail -n +$((KEEP_RELEASES + 1)) | while read -r old; do
  [[ "$old" == "$CURRENT" ]] || rm -rf -- "$old"
done
log "Deploy of ${SHA:0:7} complete in $(( $(date +%s) - STARTED ))s"
