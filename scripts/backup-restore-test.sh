#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_DIR:?BACKUP_DIR is required}"
: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL is required}"

rm -rf "$BACKUP_DIR"
mkdir -p "$BACKUP_DIR"
BACKUP_DIR="$BACKUP_DIR" DATABASE_URL="$DATABASE_URL" bash scripts/backup-postgres.sh
BACKUP_FILE="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name '*.dump' -print -quit)"
test -n "$BACKUP_FILE"
RESTORE_DATABASE_URL="$RESTORE_DATABASE_URL" BACKUP_FILE="$BACKUP_FILE" CONFIRM_RESTORE=YES bash scripts/restore-postgres.sh

psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='organizations';
SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='security_events';
SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='platform_records';
SELECT 1 FROM pg_class WHERE relname='security_events' AND relrowsecurity;
SELECT 1 FROM pg_class WHERE relname='security_events' AND relforcerowsecurity;
SQL

echo "[+] Backup/restore integration test: PASS"
