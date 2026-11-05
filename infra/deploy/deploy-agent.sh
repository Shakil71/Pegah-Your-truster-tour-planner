#!/usr/bin/env bash
# Pull-based continuous deployment (every 2 minutes from a systemd timer, as
# `pegah`). No inbound access and no self-hosted runner, so the public
# repository cannot be used to run code on this server.
#
# Rule (ADR-0017): the head of `main` is deployed when
#   1. it differs from the deployed commit and has not failed before, and
#   2. every required GitHub Actions CI job for that exact commit succeeded.
# Pushing to `main` (owner-approved) is the production approval.
set -euo pipefail

REPO="Shakil71/Pegah-Your-truster-tour-planner"
BRANCH=main
STATE=/opt/pegah/shared/state
# Every job listed here must succeed (check-run names separated by "|", kept in
# sync with .github/workflows/ci.yml).
CI_JOBS="Format, lint, typecheck, test, build|Database integration (MySQL 8.4)|End-to-end and accessibility (Playwright + axe)"

sha="$(git ls-remote "https://github.com/$REPO.git" "refs/heads/$BRANCH" | cut -f1)"
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || { echo "Could not read $BRANCH head"; exit 0; }

[[ "$(cat "$STATE/deployed-sha" 2>/dev/null)" == "$sha" ]] && exit 0
if grep -xF "$sha" "$STATE/failed-shas" >/dev/null 2>&1; then exit 0; fi

# Ask GitHub whether CI passed for this commit (public API, no token).
verdict="$(curl -fsS -H 'Accept: application/vnd.github+json' \
  "https://api.github.com/repos/$REPO/commits/$sha/check-runs?per_page=100" |
  node -e '
    let s = ""; process.stdin.on("data", d => s += d).on("end", () => {
      const all = JSON.parse(s).check_runs || [];
      const verdicts = process.argv[1].split("|").map((name) => {
        const runs = all.filter((r) => r.name === name);
        if (runs.length === 0 || runs.some((r) => r.status !== "completed")) return "pending";
        return runs.every((r) => r.conclusion === "success") ? "success" : "failure";
      });
      console.log(verdicts.includes("failure") ? "failure" : verdicts.includes("pending") ? "pending" : "success");
    });' "$CI_JOBS")"

case "$verdict" in
  pending) echo "$BRANCH ${sha:0:7}: CI not finished yet" ;;
  failure) echo "$BRANCH ${sha:0:7}: CI failed — not deploying"; echo "$sha" >>"$STATE/failed-shas" ;;
  success) echo "$BRANCH ${sha:0:7}: CI passed — deploying"; exec /opt/pegah/bin/deploy.sh "$sha" ;;
esac
