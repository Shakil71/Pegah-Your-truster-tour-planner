#!/usr/bin/env bash
# Pull-based continuous deployment (runs every 2 minutes from a systemd timer
# as `pegah`). No inbound access and no self-hosted runner are needed, so a
# public repository cannot be used to run code on this server.
#
# Rule: the newest v* tag is deployed only if
#   1. it has not been deployed (or failed) before, and
#   2. GitHub Actions CI for that exact commit finished successfully.
# Creating the tag is the owner's manual approval for production.
set -euo pipefail

REPO="Shakil71/Pegah-Your-truster-tour-planner"
STATE=/opt/pegah/shared/state
CI_JOB_NAME="Format, lint, typecheck, test, build"

latest="$(git ls-remote --tags --refs "https://github.com/$REPO.git" 'v*' |
  sed -E 's#.*refs/tags/##' | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -1 || true)"
[[ -n "$latest" ]] || exit 0

[[ "$(cat "$STATE/deployed-tag" 2>/dev/null)" == "$latest" ]] && exit 0
grep -qxF "$latest" "$STATE/failed-tags" 2>/dev/null && exit 0

sha="$(git ls-remote "https://github.com/$REPO.git" "refs/tags/$latest^{}" "refs/tags/$latest" |
  head -1 | cut -f1)"

# Ask GitHub whether CI passed for this commit (public API, no token).
verdict="$(curl -fsS -H 'Accept: application/vnd.github+json' \
  "https://api.github.com/repos/$REPO/commits/$sha/check-runs?per_page=100" |
  node -e '
    let s = ""; process.stdin.on("data", d => s += d).on("end", () => {
      const runs = (JSON.parse(s).check_runs || []).filter(r => r.name === process.argv[1]);
      if (runs.length === 0) return console.log("pending");
      if (runs.some(r => r.status !== "completed")) return console.log("pending");
      console.log(runs.every(r => r.conclusion === "success") ? "success" : "failure");
    });' "$CI_JOB_NAME")"

case "$verdict" in
  pending) echo "Tag $latest ($sha): CI not finished yet"; exit 0 ;;
  failure) echo "Tag $latest ($sha): CI failed — not deploying"; echo "$latest" >>"$STATE/failed-tags"; exit 0 ;;
  success) echo "Tag $latest ($sha): CI passed — deploying"; exec /opt/pegah/bin/deploy.sh "$latest" ;;
esac
