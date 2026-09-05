#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${AUTH_SECRET:?AUTH_SECRET is required}"

if [[ "${NODE_ENV:-production}" != "production" ]]; then
  echo "NODE_ENV must be production for release validation" >&2
  exit 1
fi
if (( ${#AUTH_SECRET} < 32 )); then
  echo "AUTH_SECRET must be at least 32 characters" >&2
  exit 1
fi

command -v node >/dev/null || { echo "node is required" >&2; exit 1; }
node --version

# Ensure required production configuration is present without printing secret values.
: "${LICENSE_PUBLIC_KEY:?LICENSE_PUBLIC_KEY is required}"

# Verify database connectivity and expected production schema/RLS posture.
psql_bin="${PSQL:-psql}"
command -v "$psql_bin" >/dev/null || { echo "psql is required" >&2; exit 1; }
"$psql_bin" "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
SELECT 1;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='organizations') THEN
    RAISE EXCEPTION 'organizations table missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='security_events') THEN
    RAISE EXCEPTION 'security_events table missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='platform_records') THEN
    RAISE EXCEPTION 'platform_records table missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='security_events' AND relrowsecurity AND relforcerowsecurity) THEN
    RAISE EXCEPTION 'security_events RLS/FORCE RLS missing';
  END IF;
END $$;
SQL

echo "Release validation: PASS"
