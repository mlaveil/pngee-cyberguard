#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
BACKUP_DIR="${BACKUP_DIR:-/var/lib/pngee/storage/backups}"
PG_BIN_DIR="${PG_BIN_DIR:-/usr/lib/postgresql/17/bin}"
PG_DUMP="${PG_DUMP:-$PG_BIN_DIR/pg_dump}"
PG_RESTORE="${PG_RESTORE:-$PG_BIN_DIR/pg_restore}"

command -v "$PG_DUMP" >/dev/null 2>&1 || { echo "pg_dump not found: $PG_DUMP" >&2; exit 1; }
command -v "$PG_RESTORE" >/dev/null 2>&1 || { echo "pg_restore not found: $PG_RESTORE" >&2; exit 1; }

mkdir -p "$BACKUP_DIR"

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
file="$BACKUP_DIR/pngee_cyberguard_${stamp}.dump"
manifest="$file.manifest"

echo "[+] Creating PostgreSQL custom-format backup: $file"
"$PG_DUMP" "$DATABASE_URL" --format=custom --no-owner --no-acl --file="$file"

sha256="$(sha256sum "$file" | awk '{print $1}')"
size="$(stat -c '%s' "$file")"
pg_version="$("$PG_DUMP" --version)"

cat > "$manifest" <<EOF
backup_file=$file
created_at=$stamp
size_bytes=$size
sha256=$sha256
pg_dump_version=$pg_version
EOF

# Structural verification: pg_restore must be able to read the archive catalog.
"$PG_RESTORE" --list "$file" >/dev/null

printf '%s\n' "[+] Backup verified: sha256:$sha256 ($size bytes)"
