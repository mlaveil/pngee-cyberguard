#!/usr/bin/env bash
set -euo pipefail

PROJECT="pngee-runtime-${RANDOM}-${RANDOM}"
DEFAULT_PORT=$(( (RANDOM % 1000) + 3000 ))
PORT="${PORT:-$DEFAULT_PORT}"
ENV_FILE="${RUNNER_TEMP:-/tmp}/pngee-runtime-${PROJECT}.env"

cleanup() {
  docker compose -p "$PROJECT" -f docker-compose.production.yml --env-file "$ENV_FILE" down -v --remove-orphans >/dev/null 2>&1 || true
  rm -f "$ENV_FILE" /tmp/pngee-runtime-health.json /tmp/pngee-runtime-second-start.log
}
trap cleanup EXIT

cat > "$ENV_FILE" <<EOF
POSTGRES_DB=pngee_runtime
POSTGRES_ADMIN_USER=postgres
POSTGRES_ADMIN_PASSWORD=ci-runtime-admin-password
POSTGRES_APP_USER=pngee_app
POSTGRES_APP_PASSWORD=ci-runtime-app-password
POSTGRES_MIGRATOR_USER=pngee_migrator
POSTGRES_MIGRATOR_PASSWORD=ci-runtime-migrator-password
APP_PORT=$PORT
TRUST_PROXY=1
PUBLIC_BASE_URL=http://127.0.0.1:$PORT
AUTH_SECRET=ci-runtime-auth-secret-must-be-at-least-32-characters-long
LICENSE_PUBLIC_KEY=ci-release-validation-key
EOF

export DOCKER_BUILDKIT=1

echo "[runtime] building production image"
docker compose -p "$PROJECT" -f docker-compose.production.yml --env-file "$ENV_FILE" build --pull cyberguard

echo "[runtime] starting production stack"
docker compose -p "$PROJECT" -f docker-compose.production.yml --env-file "$ENV_FILE" up -d

for attempt in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:$PORT/api/health" >/tmp/pngee-runtime-health.json 2>/dev/null; then
    break
  fi
  if [ "$attempt" -eq 60 ]; then
    docker compose -p "$PROJECT" -f docker-compose.production.yml --env-file "$ENV_FILE" ps
    docker compose -p "$PROJECT" -f docker-compose.production.yml --env-file "$ENV_FILE" logs --no-color cyberguard postgres
    exit 1
  fi
  sleep 2
done

cat /tmp/pngee-runtime-health.json

grep -Eq '"status"[[:space:]]*:[[:space:]]*"(ok|healthy)"|"healthy"[[:space:]]*:[[:space:]]*true' /tmp/pngee-runtime-health.json || {
  echo "[runtime] health endpoint did not report healthy status" >&2
  exit 1
}

echo "[runtime] verifying application role is non-privileged"
docker compose -p "$PROJECT" -f docker-compose.production.yml --env-file "$ENV_FILE" exec -T postgres \
  psql -U postgres -d pngee_runtime -v ON_ERROR_STOP=1 \
  -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pngee_app' AND rolsuper = false AND rolbypassrls = false) THEN RAISE EXCEPTION 'pngee_app must be NOSUPERUSER and NOBYPASSRLS'; END IF; END \$\$;"

echo "[runtime] verifying migrations are applied and idempotent"
docker compose -p "$PROJECT" -f docker-compose.production.yml --env-file "$ENV_FILE" exec -T cyberguard node docker-entrypoint.cjs >/tmp/pngee-runtime-second-start.log 2>&1 || {
  cat /tmp/pngee-runtime-second-start.log
  exit 1
}

grep -q 'Migration failed' /tmp/pngee-runtime-second-start.log && {
  cat /tmp/pngee-runtime-second-start.log
  exit 1
}

echo "Production deployment runtime validation: PASS"
