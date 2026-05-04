#!/bin/bash
set -euo pipefail
# PostgreSQL backup script.
# Run via cron or manually:
#   docker exec agentflow_postgres /scripts/backup_db.sh
#   or from host: ./scripts/backup_db.sh
#
# Restoring a backup:
#   gunzip -c backup_file.sql.gz | \
#     docker exec -i agentflow_postgres \
#       psql -U agentflow -d agentflow

BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
DB_NAME="${PGDATABASE:-agentflow}"
DB_USER="${PGUSER:-agentflow}"
DB_HOST="${PGHOST:-localhost}"
DB_PORT="${PGPORT:-5432}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="${BACKUP_DIR}/agentflow_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[backup] Starting backup of database '${DB_NAME}' → ${FILENAME}"

pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --no-password \
    --format=plain \
    --no-owner \
    --no-acl \
    | gzip -9 > "$FILENAME"

SIZE=$(du -sh "$FILENAME" | cut -f1)
echo "[backup] Done — ${FILENAME} (${SIZE})"

# ── Remove backups older than RETENTION_DAYS ───────────────────────────────
echo "[backup] Pruning backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name "agentflow_*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete
REMAINING=$(find "$BACKUP_DIR" -name "agentflow_*.sql.gz" | wc -l)
echo "[backup] ${REMAINING} backup(s) retained"
