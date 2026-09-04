#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
BACKUP_DIR="${BACKUP_DIR:-/var/lib/pngee/storage/backups}"
mkdir -p "$BACKUP_DIR"

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
file="$BACKUP_DIR/pngee_cyberguard_${stamp}.dump"
manifest="$file.manifest"

echo "[+] Creating PostgreSQL custom-format backup: $file"
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-acl --file="$file"

sha256="$(sha256sum "$file" | awk '{print $1}')"
size="$(stat -c '%s' "$file")"
pg_version="$(pg_dump --version)"

cat > "$manifest" <<EOF
backup_file=$file
created_at=$stamp
size_bytes=$size
sha256=$sha256
pg_dump_version=$pg_version
EOF

# Structural verification: pg_restore must be able to read the archive catalog.
pg_restore --list "$file" >/dev/null

printf '%s\n' "[+] Backup verified: sha256:$sha256 ($size bytes)"
