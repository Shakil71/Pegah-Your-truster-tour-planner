# Monitoring and the worker (ADR-0027)

## What runs where

| Process          | Listens on     | Purpose                                                   |
| ---------------- | -------------- | --------------------------------------------------------- |
| `pegah-api`      | 127.0.0.1:4100 | HTTP API                                                  |
| `pegah-api`      | 127.0.0.1:9464 | Prometheus metrics (process, request latency)             |
| `pegah-worker`   | 127.0.0.1:9465 | Metrics; runs hold expiry, email outbox, reconciliation   |
| `prometheus`     | 127.0.0.1:9091 | Scrapes the above every 30 s; keeps 30 days; alert rules  |
| `node_exporter`  | 127.0.0.1:9100 | Server CPU, memory, disk                                  |
| `grafana-server` | 127.0.0.1:3300 | Dashboards ("Pegah overview")                             |
| Redis (existing) | 127.0.0.1:6379 | Shared rate limits, ACL user `pegah`, keys `pegah:*` only |

Nothing above is public: no firewall port is opened and Nginx does not proxy
any of it. 9090 belongs to Cockpit and 3000 to another application on this
server, which is why Prometheus and Grafana use 9091 and 3300.

## One-time setup (owner, as root)

Run after a deploy that contains these scripts, in this order:

```bash
sudo bash /opt/pegah/current/infra/server/enable-worker-redis.sh   # server modification
sudo bash /opt/pegah/current/infra/server/enable-monitoring.sh     # server modification
```

Both are idempotent and print what they did, never secrets. The first creates
the Redis ACL user and the worker; until it runs, the API keeps running the
background jobs itself and rate limits stay per process (no loss of function).
The second downloads checksum-verified Prometheus 3.13.5 and node_exporter
1.12.1 and configures the Grafana package already installed on the server.

## Opening Grafana

From your own computer (read-only for the server):

```bash
ssh -L 3300:127.0.0.1:3300 pegah@192.168.197.100
```

Then open <http://localhost:3300>, user `admin`. The password is in
`/root/pegah-grafana-admin.txt` on the server (`sudo cat` it). Change it in
Grafana after the first sign-in if you like; the file is only used at setup.

The "Pegah overview" dashboard shows: API and worker up, bookings held,
bookings waiting for a staff check, payments to refund, failed outbox events
and emails, request rate by result, p95 latency, slowest routes, process
memory, server CPU and free disk.

## Alerts

Rules in `infra/monitoring/pegah-alerts.yml` (process down, server errors,
slow API, refund required, outbox stuck, disk filling) are visible in Grafana
and at Prometheus `/alerts`. No notification channel is configured yet: that
needs an owner-approved email (SMTP) or chat destination.

## Logs

Application logs are structured JSON in journald:
`journalctl -u pegah-api -u pegah-worker --since "1 hour ago"`. Central log
storage (Loki) is deferred: on one server journald with its retention is
enough, and Loki would be the next step when a second server or staging
exists.

## Checks

```bash
systemctl is-active pegah-worker prometheus node_exporter grafana-server   # read-only
curl -s 127.0.0.1:9465/metrics | grep ^pegah_bookings_held                 # read-only
curl -s 127.0.0.1:9091/api/v1/targets | grep -o '"health":"[a-z]*"'         # read-only
```
