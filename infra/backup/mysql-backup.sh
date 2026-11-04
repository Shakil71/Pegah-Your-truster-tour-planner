#!/usr/bin/env bash
# Nightly logical backup of the `pegah` database (runs as `pegah` from
# pegah-backup.timer). Consistent snapshot without locking InnoDB tables.
# Output: /databackup/mysql-backups/pegah-<UTC>.sql.gz + .sha256, kept 14 days.
# NOTE: /databackup is on the same physical disk as the OS; copy backups
# off-host as well (see docs/operations/BACKUP_RECOVERY.md).
set -euo pipefail

DIR=/databackup/mysql-backups
KEEP_DAYS=14
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$DIR/pegah-$STAMP.sql.gz"

umask 077
mysqldump --defaults-extra-file=/opt/pegah/shared/env/backup.cnf \
  --single-transaction --quick --triggers \
  --no-tablespaces --set-gtid-purged=OFF --default-character-set=utf8mb4 \
  pegah | gzip -9 >"$OUT.partial"
mv "$OUT.partial" "$OUT"
(cd "$DIR" && sha256sum "$(basename "$OUT")" >"$(basename "$OUT").sha256")
gzip -t "$OUT"

find "$DIR" -name 'pegah-*.sql.gz*' -type f -mtime +"$KEEP_DAYS" -delete
echo "Backup written: $OUT ($(du -h "$OUT" | cut -f1))"
