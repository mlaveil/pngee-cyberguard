#!/usr/bin/env bash
set -euo pipefail

: "${BACKUP_DIR:?BACKUP_DIR is required}"
: "${S3_BUCKET:?S3_BUCKET is required when offsite replication is enabled}"
S3_PREFIX="${S3_PREFIX:-pngee-cyberguard/}"
AWS_REGION="${AWS_REGION:-}"
S3_SSE="${S3_SSE:-AES256}"

command -v aws >/dev/null 2>&1 || { echo "aws CLI is required for offsite backup replication" >&2; exit 1; }

latest="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'pngee_cyberguard_*.dump' -printf '%T@ %p\n' | sort -nr | head -n1 | cut -d' ' -f2- || true)"
[[ -n "$latest" && -f "$latest" ]] || { echo "No PostgreSQL backup available for offsite replication" >&2; exit 1; }

manifest="$latest.manifest"
[[ -f "$manifest" ]] || { echo "Backup manifest missing: $manifest" >&2; exit 1; }
sha256="$(awk -F= '$1=="sha256"{print $2}' "$manifest")"
[[ "$sha256" =~ ^[0-9a-f]{64}$ ]] || { echo "Invalid backup manifest checksum" >&2; exit 1; }
actual="$(sha256sum "$latest" | awk '{print $1}')"
[[ "$sha256" == "$actual" ]] || { echo "Backup checksum mismatch; refusing offsite upload" >&2; exit 1; }

key="${S3_PREFIX%/}/$(basename "$latest")"
args=(s3 cp "$latest" "s3://$S3_BUCKET/$key" --sse "$S3_SSE" --metadata "sha256=$sha256")
[[ -n "$AWS_REGION" ]] && args+=(--region "$AWS_REGION")

"${args[@]}"
echo "[+] Offsite backup uploaded: s3://$S3_BUCKET/$key"

# Upload the manifest separately so restore operators can verify the archive without downloading it first.
manifest_args=(s3 cp "$manifest" "s3://$S3_BUCKET/$key.manifest" --sse "$S3_SSE")
[[ -n "$AWS_REGION" ]] && manifest_args+=(--region "$AWS_REGION")
"${manifest_args[@]}"

echo "Offsite backup replication: PASS"
