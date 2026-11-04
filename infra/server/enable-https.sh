#!/usr/bin/env bash
# Pegah — HTTPS on :8443 with a self-signed certificate (ADR-0019). Run as root
# by the owner, after reading it:
#
#   sudo bash /home/pegah/pegah-infra/server/enable-https.sh
#
# Idempotent. Also called by bootstrap-root.sh on fresh servers.
#
# What it does (and nothing else):
#   1. Creates a self-signed certificate for the server's IPs in
#      /etc/pki/tls/pegah (key 0600 root:root, SELinux cert_t) — once.
#   2. Installs infra/nginx/pegah.conf (8443 HTTPS, 8180 → HTTPS redirect),
#      tests it, and rolls back if the test fails (nginx is shared).
#   3. SELinux: makes sure 8180 and 8443 are http_port_t. firewalld: opens 8443.
#   4. Adds the https:// origins to APP_ORIGINS in api.env and restarts the API.
# It never prints secrets, never touches other tenants' sites, and never
# disables SELinux or firewalld.
set -euo pipefail

INFRA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HTTP_PORT=8180
HTTPS_PORT=8443
IPS=(192.168.197.100 27.147.147.228)
CERT_DIR=/etc/pki/tls/pegah
ENV_FILE=/opt/pegah/shared/env/api.env

log() { printf '\n\033[1;33m==> %s\033[0m\n' "$*"; }
die() { printf '\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Run as root (sudo)."
[[ "$(getenforce)" == "Enforcing" ]] || die "SELinux must be Enforcing; this script will not change that."

# ── 1. Certificate ────────────────────────────────────────────────────────────
log "Self-signed certificate"
install -d -m 0755 "$CERT_DIR"
if [[ ! -f "$CERT_DIR/pegah-selfsigned.crt" ]]; then
  san="$(printf 'IP:%s,' "${IPS[@]}")"
  umask 077
  openssl req -x509 -newkey rsa:3072 -sha256 -nodes -days 397 \
    -subj "/CN=Pegah pre-launch" \
    -addext "subjectAltName=${san%,}" \
    -addext "keyUsage=digitalSignature,keyEncipherment" \
    -addext "extendedKeyUsage=serverAuth" \
    -keyout "$CERT_DIR/pegah-selfsigned.key" -out "$CERT_DIR/pegah-selfsigned.crt" 2>/dev/null
  chmod 0600 "$CERT_DIR/pegah-selfsigned.key"
  chmod 0644 "$CERT_DIR/pegah-selfsigned.crt"
  echo "created $CERT_DIR/pegah-selfsigned.crt"
else
  echo "kept existing certificate"
fi
restorecon -R "$CERT_DIR"
openssl x509 -in "$CERT_DIR/pegah-selfsigned.crt" -noout -enddate -fingerprint -sha256

# ── 2. nginx ──────────────────────────────────────────────────────────────────
log "nginx (HTTPS :$HTTPS_PORT, :$HTTP_PORT redirects)"
for port in "$HTTP_PORT" "$HTTPS_PORT"; do
  if ! semanage port -l | grep -E "^http_port_t\s" | grep -w "$port" >/dev/null; then
    semanage port -a -t http_port_t -p tcp "$port" 2>/dev/null ||
      semanage port -m -t http_port_t -p tcp "$port"
  fi
done
backup=""
if [[ -f /etc/nginx/conf.d/pegah.conf ]]; then
  backup="$(mktemp)"
  cp -p /etc/nginx/conf.d/pegah.conf "$backup"
fi
install -m 0644 "$INFRA_DIR/nginx/pegah.conf" /etc/nginx/conf.d/pegah.conf
if ! nginx -t; then
  if [[ -n "$backup" ]]; then cp -p "$backup" /etc/nginx/conf.d/pegah.conf; else rm -f /etc/nginx/conf.d/pegah.conf; fi
  die "nginx config test failed; previous pegah.conf restored, nginx untouched."
fi
systemctl reload nginx
[[ -n "$backup" ]] && rm -f "$backup"

# ── 3. firewalld ──────────────────────────────────────────────────────────────
log "firewalld"
firewall-cmd --permanent --add-port="${HTTP_PORT}/tcp" >/dev/null
firewall-cmd --permanent --add-port="${HTTPS_PORT}/tcp" >/dev/null
firewall-cmd --reload >/dev/null
firewall-cmd --list-ports

# ── 4. API origins ────────────────────────────────────────────────────────────
log "API allowed origins"
if [[ -f "$ENV_FILE" ]]; then
  origins="$(printf 'https://%s:'"$HTTPS_PORT"',' "${IPS[@]}")"
  origins="${origins%,}"
  if grep -q '^APP_ORIGINS=' "$ENV_FILE"; then
    sed -i "s#^APP_ORIGINS=.*#APP_ORIGINS=${origins}#" "$ENV_FILE"
  else
    echo "APP_ORIGINS=${origins}" >>"$ENV_FILE"
  fi
  grep '^APP_ORIGINS=' "$ENV_FILE"
  if systemctl is-active --quiet pegah-api.service; then
    systemctl restart pegah-api.service
    echo "pegah-api restarted"
  fi
else
  echo "$ENV_FILE not found yet; bootstrap-root.sh writes it with these origins."
fi

log "Done"
cat <<MSG
Open https://${IPS[0]}:${HTTPS_PORT} — the browser warns once because the
certificate is self-signed; check that the SHA-256 fingerprint above matches,
then continue. http://${IPS[0]}:${HTTP_PORT} now redirects to HTTPS.
MSG
