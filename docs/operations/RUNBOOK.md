# Runbook

Status: **placeholder**. Procedures are written as each service is implemented
and verified. Nothing is running yet.

## Planned procedures

| Situation | Procedure | Status |
| --- | --- | --- |
| Service down | `systemctl status pegah-<svc>`, `journalctl -u pegah-<svc> -n 200` | To write in Phase 9 |
| Roll back a release | Switch `/opt/pegah/current` symlink, restart Pegah units | To write in Phase 9 |
| Payment stuck in PAYMENT_PROCESSING | Run reconciliation job; move to MANUAL_REVIEW | To write in Phase 5 |
| Webhook failures | Check signature errors, replay from gateway dashboard | To write in Phase 5 |
| Disk space on /databackup | Check retention job, free-space alert | To write in Phase 9 |
| Restore from backup | See BACKUP_RECOVERY.md | To write in Phase 9 |
