#!/usr/bin/env bash
# Builds the cPanel upload bundle (ADR-0040) from a clean checkout on Linux x64.
# Run by .github/workflows/cpanel-bundle.yml; output: pegah-cpanel-<sha>.tar.gz
#
#   pegah/api      Node.js app "API"     (startup file: dist/main.js)
#   pegah/web      Node.js app "Website" (startup file: server.js)
#   pegah/admin    Node.js app "Console" (startup file: server.js)
#   pegah/migrate  database migrations (prisma CLI installed on the server)
#
# No secrets are read or written here: every credential is entered in cPanel.
set -euo pipefail

# Public address of the site. Next.js bakes its /media, /api and /admin rewrites
# at build time, and on cPanel those go through the public origin.
SITE_URL="${SITE_URL:-https://pegah.com.bd}"
case "$SITE_URL" in https://*) ;; *) echo "SITE_URL must start with https://" >&2; exit 2 ;; esac

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/.cpanel"
SHA="$(git -C "$ROOT" rev-parse --short HEAD)"
rm -rf "$OUT" && mkdir -p "$OUT/pegah"
cd "$ROOT"

echo "== Build (standalone Next.js output)"
npm ci
NEXT_OUTPUT=standalone API_INTERNAL_URL="$SITE_URL" ADMIN_INTERNAL_URL="$SITE_URL" npx turbo run build --force

echo "== Website and console"
for app in web admin; do
  dest="$OUT/pegah/$app"
  mkdir -p "$dest"
  # The standalone tree mirrors the monorepo; the app's server.js sits in apps/<app>.
  cp -a "apps/$app/.next/standalone/." "$dest/"
  mkdir -p "$dest/apps/$app/.next"
  cp -a "apps/$app/.next/static" "$dest/apps/$app/.next/static"
  if [ -d "apps/$app/public" ]; then cp -a "apps/$app/public" "$dest/apps/$app/public"; fi
  # Passenger starts this file; it changes into the app folder and loads Next's server.
  cat >"$dest/server.js" <<EOF
// cPanel / Passenger entry for the Pegah $app (ADR-0040).
process.chdir(__dirname + "/apps/$app");
require("./apps/$app/server.js");
EOF
done

echo "== API (production dependencies only)"
api="$OUT/pegah/api"
mkdir -p "$api"
work="$(mktemp -d)"
cp package.json package-lock.json "$work/"
mkdir -p "$work/apps" "$work/packages"
cp -a apps/api "$work/apps/api"
for p in packages/*/; do cp -a "$p" "$work/packages/"; done
(cd "$work" && npm ci --omit=dev --workspace @pegah/api --include-workspace-root=false --ignore-scripts)
cp -a "$work/apps/api/dist" "$api/dist"
cp -a "$work/apps/api/scripts" "$api/scripts"
cp "$work/apps/api/package.json" "$api/package.json"
# Workspace packages are symlinks in node_modules: copy them as real folders.
cp -aL "$work/node_modules" "$api/node_modules"
if [ -d "$work/apps/api/node_modules" ]; then cp -aL "$work/apps/api/node_modules/." "$api/node_modules/"; fi
rm -rf "$work"

echo "== Migrations"
mig="$OUT/pegah/migrate"
mkdir -p "$mig"
cp -a packages/db/prisma "$mig/prisma"
cp packages/db/prisma.config.ts "$mig/prisma.config.ts"
PRISMA_VERSION="$(node -p "require('./packages/db/package.json').devDependencies.prisma")"
cat >"$mig/package.json" <<EOF
{
  "name": "pegah-migrate",
  "private": true,
  "description": "Applies Pegah database migrations: npm install, then npx prisma migrate deploy",
  "dependencies": { "prisma": "$PRISMA_VERSION" }
}
EOF

cp infra/cpanel/README.txt "$OUT/pegah/README.txt"
printf '%s\nbuilt for %s\n' "$SHA" "$SITE_URL" >"$OUT/pegah/VERSION"
tar -C "$OUT" -czf "$ROOT/pegah-cpanel-$SHA.tar.gz" pegah
du -sh "$ROOT/pegah-cpanel-$SHA.tar.gz"
