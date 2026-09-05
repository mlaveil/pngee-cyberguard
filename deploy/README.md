# PNGee CyberGuard v3 deployment

## Production container deployment

1. Copy `.env.production.example` to `.env` on the deployment host.
2. Set a unique PostgreSQL password and an `AUTH_SECRET` of at least 32 characters.
3. Set `LICENSE_PUBLIC_KEY` to the public key used to verify issued CyberGuard licenses.
4. Build and start the stack:

```bash
docker compose -f deploy/docker-compose.yml --env-file .env up -d --build
```

5. Verify the application health endpoint:

```bash
curl -fsS http://127.0.0.1:${APP_PORT:-3000}/api/health
```

Put a TLS reverse proxy/load balancer in front of the application for production traffic. Do not expose PostgreSQL publicly.

## Database backups

The application image contains the PostgreSQL backup/restore scripts. Run backups from a controlled host using PostgreSQL 17 client tools and store the resulting backup directory outside the application container. Backups must be protected as sensitive security data.

The CI pipeline validates backup creation, checksum integrity, isolated database recreation, restore, and RLS integrity. Production still requires an operational retention/offsite backup policy before release.

## Endpoint agents

The endpoint agent remains separately installed on monitored Windows/Linux systems using the installers under `agent/`. Enroll each endpoint against the deployed API using a tenant-issued enrollment token.

## Release checks

Before promoting a deployment, require the `CyberGuard v3 CI` workflow to pass and verify `/api/health` returns a healthy database status.
