#!/usr/bin/env bash
# Pegah — monitoring: Prometheus + node_exporter + Grafana (ADR-0027).
# Run as root by the owner, after reading it (and after enable-worker-redis.sh):
#
#   sudo bash /opt/pegah/current/infra/server/enable-monitoring.sh
#
# Idempotent. What it does (and nothing else):
#   1. Installs pinned, checksum-verified official releases of Prometheus
#      3.13.5 (long-term line) and node_exporter 1.12.1 under /opt, as the
#      unprivileged system users "prometheus" and "node_exporter".
#   2. Prometheus listens on 127.0.0.1:9091 (9090 belongs to Cockpit),
#      node_exporter on 127.0.0.1:9100; 30 days of data in /var/lib/prometheus.
#   3. Configures the already-installed Grafana (RHEL package) on
#      127.0.0.1:3300 (3000 is taken by another application) through a systemd
#      drop-in, with the Pegah data source and dashboard provisioned. The
#      Grafana admin password is generated and stored in
#      /root/pegah-grafana-admin.txt (0600); it is not printed.
#   4. SELinux: labels the binaries bin_t; allows Grafana's port only if the
#      policy confines Grafana to a port type. Opens NO firewall ports: use an
#      SSH tunnel (see docs/operations/MONITORING.md).
# It never disables SELinux or firewalld and never touches other applications.
set -euo pipefail

INFRA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROM_VERSION=3.13.5
PROM_SHA256=0388822ace519c5a3a8ef556a541ce1b536e21d872f82deded465bd27a5a0699
NODE_VERSION=1.12.1
NODE_SHA256=b51d8a76aa2a9156a55d501aca6276fae09e262259a5e4e831d2c2222f084e63
GRAFANA_PORT=3300

log() { printf '\n\033[1;33m==> %s\033[0m\n' "$*"; }
die() { printf '\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Run as root (sudo)."
[[ "$(getenforce)" == "Enforcing" ]] || die "SELinux must be Enforcing; this script will not change that."
[[ "$(uname -m)" == "x86_64" ]] || die "Only x86_64 tarballs are pinned here."
for port in 9091 9100 "$GRAFANA_PORT"; do
  owner="$(ss -ltnpH "sport = :$port" | grep -oE "users:\(\(\"[^\"]+" | sed "s/.*\"//" | head -1 || true)"
  [[ -z "$owner" || "$owner" =~ ^(prometheus|node_exporter|grafana.*)$ ]] || die "Port $port is used by $owner."
done

fetch() { # name version sha url
  local tarball="/var/cache/pegah-monitoring/$1-$2.linux-amd64.tar.gz"
  install -d -m 0755 /var/cache/pegah-monitoring
  [[ -f "$tarball" ]] || curl -fsSL -o "$tarball" "$4"
  echo "$3  $tarball" | sha256sum -c --quiet - || { rm -f "$tarball"; die "Checksum mismatch for $1 $2."; }
  install -d -m 0755 "/opt/$1-$2"
  tar -xzf "$tarball" -C "/opt/$1-$2" --strip-components=1 --no-same-owner
  ln -sfn "/opt/$1-$2" "/opt/$1"
}

system_user() { id "$1" >/dev/null 2>&1 || useradd --system --no-create-home --shell /sbin/nologin "$1"; }

# ── 1–2. Prometheus and node_exporter ────────────────────────────────────────
log "Prometheus $PROM_VERSION and node_exporter $NODE_VERSION (checksum-verified)"
fetch prometheus "$PROM_VERSION" "$PROM_SHA256" \
  "https://github.com/prometheus/prometheus/releases/download/v$PROM_VERSION/prometheus-$PROM_VERSION.linux-amd64.tar.gz"
fetch node_exporter "$NODE_VERSION" "$NODE_SHA256" \
  "https://github.com/prometheus/node_exporter/releases/download/v$NODE_VERSION/node_exporter-$NODE_VERSION.linux-amd64.tar.gz"
system_user prometheus
system_user node_exporter

semanage fcontext -a -t bin_t "/opt/prometheus-[^/]+/(prometheus|promtool)" 2>/dev/null ||
  semanage fcontext -m -t bin_t "/opt/prometheus-[^/]+/(prometheus|promtool)"
semanage fcontext -a -t bin_t "/opt/node_exporter-[^/]+/node_exporter" 2>/dev/null ||
  semanage fcontext -m -t bin_t "/opt/node_exporter-[^/]+/node_exporter"
restorecon -RF "/opt/prometheus-$PROM_VERSION" "/opt/node_exporter-$NODE_VERSION"

install -d -m 0755 /etc/prometheus
install -m 0644 "$INFRA_DIR/monitoring/prometheus.yml" /etc/prometheus/prometheus.yml
install -m 0644 "$INFRA_DIR/monitoring/pegah-alerts.yml" /etc/prometheus/pegah-alerts.yml
/opt/prometheus/promtool check config /etc/prometheus/prometheus.yml >/dev/null || die "Prometheus config check failed."
install -d -m 0750 -o prometheus -g prometheus /var/lib/prometheus
install -m 0644 "$INFRA_DIR/monitoring/prometheus.service" /etc/systemd/system/prometheus.service
install -m 0644 "$INFRA_DIR/monitoring/node_exporter.service" /etc/systemd/system/node_exporter.service
restorecon -F /etc/systemd/system/prometheus.service /etc/systemd/system/node_exporter.service /etc/prometheus/*

# ── 3. Grafana ───────────────────────────────────────────────────────────────
log "Grafana on 127.0.0.1:$GRAFANA_PORT"
rpm -q grafana >/dev/null || die "Grafana package is not installed; this script does not install it."
secret_file=/root/pegah-grafana-admin.txt
if [[ ! -s "$secret_file" ]]; then
  umask 077
  openssl rand -base64 24 | tr -d '\n' >"$secret_file"
fi
install -d -m 0755 /etc/systemd/system/grafana-server.service.d
umask 077
cat >/etc/systemd/system/grafana-server.service.d/pegah.conf <<EOF
# Managed by Pegah (infra/server/enable-monitoring.sh)
[Service]
Environment=GF_SERVER_HTTP_ADDR=127.0.0.1
Environment=GF_SERVER_HTTP_PORT=$GRAFANA_PORT
Environment=GF_ANALYTICS_REPORTING_ENABLED=false
Environment=GF_ANALYTICS_CHECK_FOR_UPDATES=false
Environment=GF_USERS_ALLOW_SIGN_UP=false
Environment=GF_AUTH_ANONYMOUS_ENABLED=false
Environment=GF_SECURITY_ADMIN_PASSWORD__FILE=$secret_file
EOF
umask 022
chmod 0600 /etc/systemd/system/grafana-server.service.d/pegah.conf
# Grafana reads the password file as its own user.
chgrp grafana "$secret_file" && chmod 0640 "$secret_file"
install -m 0644 "$INFRA_DIR/monitoring/grafana-datasource.yaml" /etc/grafana/provisioning/datasources/pegah.yaml
install -m 0644 "$INFRA_DIR/monitoring/grafana-dashboards.yaml" /etc/grafana/provisioning/dashboards/pegah.yaml
install -d -m 0755 -o grafana -g grafana /var/lib/grafana/dashboards/pegah
install -m 0644 -o grafana -g grafana "$INFRA_DIR/monitoring/pegah-overview.json" /var/lib/grafana/dashboards/pegah/
restorecon -RF /etc/grafana/provisioning /var/lib/grafana/dashboards /etc/systemd/system/grafana-server.service.d
if seinfo -t grafana_port_t >/dev/null 2>&1 || semanage port -l | grep -q '^grafana_port_t'; then
  semanage port -a -t grafana_port_t -p tcp "$GRAFANA_PORT" 2>/dev/null ||
    semanage port -m -t grafana_port_t -p tcp "$GRAFANA_PORT"
fi

# ── Start ────────────────────────────────────────────────────────────────────
log "Starting services"
systemctl daemon-reload
systemctl enable --now node_exporter.service prometheus.service grafana-server.service
systemctl restart node_exporter.service prometheus.service grafana-server.service
sleep 8
# Applies the password even if Grafana already had a database (read from stdin, never argv).
runuser -u grafana -- grafana-cli --homepath /usr/share/grafana --config /etc/grafana/grafana.ini   admin reset-admin-password --password-from-stdin <"$secret_file" >/dev/null 2>&1 ||
  echo "(could not reset the Grafana admin password; the file still applies on first start)"
systemctl is-active node_exporter.service prometheus.service grafana-server.service
curl -fsS http://127.0.0.1:9091/-/ready && echo
curl -fsS -o /dev/null http://127.0.0.1:$GRAFANA_PORT/api/health && echo "Grafana up on 127.0.0.1:$GRAFANA_PORT."
echo "Targets:"
curl -fsS http://127.0.0.1:9091/api/v1/targets |
  grep -oE '"job":"[^"]+"|"health":"[^"]+"' | paste - - | sort -u
echo "Done. Grafana admin password is in $secret_file (root only). See docs/operations/MONITORING.md."
