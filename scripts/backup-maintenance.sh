#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/lib/pngee/storage/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
MIN_BACKUPS="${MIN_BACKUPS:-7}"
MAX_BACKUPS="${MAX_BACKUPS:-35}"

[[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]] || { echo "RETENTION_DAYS must be an integer" >&2; exit 1; }
[[ "$MIN_BACKUPS" =~ ^[0-9]+$ ]] || { echo "MIN_BACKUPS must be an integer" >&2; exit 1; }
[[ "$MAX_BACKUPS" =~ ^[0-9]+$ ]] || { echo "MAX_BACKUPS must be an integer" >&2; exit 1; }
(( MIN_BACKUPS <= MAX_BACKUPS )) || { echo "MIN_BACKUPS must not exceed MAX_BACKUPS" >&2; exit 1; }

mkdir -p "$BACKUP_DIR"
mapfile -t backups < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'pngee_cyberguard_*.dump' -printf '%T@ %p\n' | sort -nr | cut -d' ' -f2-)

count=${#backups[@]}
if (( count == 0 )); then
  echo "No PostgreSQL backups found in $BACKUP_DIR" >&2
  exit 1
fi

# Never delete the newest MIN_BACKUPS, even when they exceed the age threshold.
for (( i=MIN_BACKUPS; i<count; i++ )); do
  file="${backups[$i]}"
  if find "$file" -maxdepth 0 -mtime "+$RETENTION_DAYS" -print -quit | grep -q .; then
    rm -f -- "$file" "$file.manifest"
    echo "[+] Removed expired backup: $file"
  fi
done

# Enforce an absolute upper bound while retaining the newest MIN_BACKUPS.
mapfile -t remaining < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'pngee_cyberguard_*.dump' -printf '%T@ %p\n' | sort -nr | cut -d' ' -f2-)
for (( i=MAX_BACKUPS; i<${#remaining[@]}; i++ )); do
  file="${remaining[$i]}"
  rm -f -- "$file" "$file.manifest"
  echo "[+] Removed excess backup: $file"
done

echo "Backup maintenance: PASS ($(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'pngee_cyberguard_*.dump' | wc -l | tr -d ' ') backups retained)"
