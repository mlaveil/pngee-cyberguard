#!/usr/bin/env bash
set -euo pipefail

: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL is required}"
: "${BACKUP_FILE:?BACKUP_FILE is required}"
PG_BIN_DIR="${PG_BIN_DIR:-/usr/lib/postgresql/17/bin}"
PG_RESTORE="${PG_RESTORE:-$PG_BIN_DIR/pg_restore}"
PSQL="${PSQL:-$PG_BIN_DIR/psql}"

command -v "$PG_RESTORE" >/dev/null 2>&1 || { echo "pg_restore not found: $PG_RESTORE" >&2; exit 1; }
command -v "$PSQL" >/dev/null 2>&1 || { echo "psql not found: $PSQL" >&2; exit 1; }

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "Backup file not found: $BACKUP_FILE" >&2
  exit 1
fi

if [[ "${CONFIRM_RESTORE:-}" != "YES" ]]; then
  echo "Refusing restore. Set CONFIRM_RESTORE=YES for an explicit restore operation." >&2
  exit 1
fi

manifest="$BACKUP_FILE.manifest"
if [[ -f "$manifest" ]]; then
  expected="$(awk -F= '$1=="sha256"{print $2}' "$manifest")"
  actual="$(sha256sum "$BACKUP_FILE" | awk '{print $1}')"
  [[ -n "$expected" && "$expected" == "$actual" ]] || { echo "Backup checksum mismatch" >&2; exit 1; }
fi

# pg_restore is intentionally pointed at a caller-selected restore database.
# Production databases must never be restored without an explicit operator choice.
echo "[+] Restoring $BACKUP_FILE into the database specified by RESTORE_DATABASE_URL"
"$PG_RESTORE" --dbname="$RESTORE_DATABASE_URL" --clean --if-exists --no-owner --no-acl "$BACKUP_FILE"

echo "[+] Running post-restore integrity checks"
"$PSQL" "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='organizations';
SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='security_events';
SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='platform_records';
SELECT 1 FROM pg_class WHERE relname='security_events' AND relrowsecurity;
SELECT 1 FROM pg_class WHERE relname='security_events' AND relforcerowsecurity;
SQL

echo "[+] Restore verification completed successfully"
