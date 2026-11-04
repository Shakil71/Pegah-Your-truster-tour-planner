# Backup and Recovery

Status: **daily logical backups implemented** (`infra/backup/mysql-backup.sh`,
`pegah-backup.timer`, 03:00 Asia/Dhaka, 14 days, files
`/databackup/mysql-backups/pegah-<UTC>.sql.gz` + `.sha256`). Weekly/monthly
tiers, binlogs/PITR, off-host copies and restore drills below are still
planned. **Risk:** `/databackup` is a partition of the same physical disk as
the OS, so an off-host copy is required before real customer data exists.

## Layout

```
/databackup/mysql-backups/daily/
/databackup/mysql-backups/weekly/
/databackup/mysql-backups/monthly/
/databackup/mysql-backups/binlogs/
/databackup/mysql-backups/manifests/
/databackup/restore-staging/
```

## Policy (proposed)

| Tier    | Schedule (Asia/Dhaka)              | Retention                               |
| ------- | ---------------------------------- | --------------------------------------- |
| Daily   | 02:00 every day                    | 14 days                                 |
| Weekly  | Sunday's daily copy promoted       | 8 weeks                                 |
| Monthly | 1st of month's daily copy promoted | 12 months                               |
| Binlogs | continuous                         | back to the oldest retained full backup |

## Method

- Consistent full backup: `mysqldump --single-transaction --routines --triggers
--events` (or Percona XtraBackup if the dataset grows), compressed.
- Binary logs enabled with `binlog_expire_logs_seconds` covering retention, for
  point-in-time recovery.
- A SHA-256 manifest per backup (file, size, checksum, MySQL version, binlog position).
- Files 0600, directories 0700, owned by a dedicated backup user.
- systemd timer, not cron; failures alert via monitoring.
- Free-space check before each run; abort and alert under threshold.
- Encrypted off-server copy (target to be chosen).

## Verification

A backup is valid only after a restore succeeds. Weekly drill: restore the
latest daily into a separate MySQL instance pointed at
`/databackup/restore-staging`, verify checksums, table counts and a set of
sanity queries, then discard. Never restore over live production without
explicit approval.
