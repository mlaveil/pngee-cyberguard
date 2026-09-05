#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
BACKUP_DIR="${BACKUP_DIR:-/var/lib/pngee/storage/backups}"

export BACKUP_DIR
bash scripts/backup-postgres.sh
bash scripts/backup-maintenance.sh

if [[ "${OFFSITE_ENABLED:-false}" == "true" ]]; then
  : "${S3_BUCKET:?S3_BUCKET is required when OFFSITE_ENABLED=true}"
  export S3_BUCKET S3_PREFIX AWS_REGION S3_SSE
  bash scripts/backup-offsite.sh
fi

echo "Production backup cycle: PASS"
