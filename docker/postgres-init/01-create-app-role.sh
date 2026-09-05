#!/usr/bin/env bash
set -euo pipefail

: "${POSTGRES_APP_USER:?POSTGRES_APP_USER is required}"
: "${POSTGRES_APP_PASSWORD:?POSTGRES_APP_PASSWORD is required}"
: "${POSTGRES_MIGRATOR_USER:?POSTGRES_MIGRATOR_USER is required}"
: "${POSTGRES_MIGRATOR_PASSWORD:?POSTGRES_MIGRATOR_PASSWORD is required}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=app_user="$POSTGRES_APP_USER" --set=app_password="$POSTGRES_APP_PASSWORD" \
  --set=migrator_user="$POSTGRES_MIGRATOR_USER" --set=migrator_password="$POSTGRES_MIGRATOR_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD %L', :'app_user', :'app_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_user')\gexec

SELECT format('ALTER ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD %L', :'app_user', :'app_password')\gexec

SELECT format('CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD %L', :'migrator_user', :'migrator_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'migrator_user')\gexec

SELECT format('ALTER ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD %L', :'migrator_user', :'migrator_password')\gexec

SELECT format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), :'app_user')\gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), :'migrator_user')\gexec
SELECT format('GRANT USAGE, CREATE ON SCHEMA public TO %I', :'migrator_user')\gexec
SELECT format('GRANT USAGE ON SCHEMA public TO %I', :'app_user')\gexec
SQL
