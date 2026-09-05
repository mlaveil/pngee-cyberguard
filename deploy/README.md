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

## Database backup policy

Backups are PostgreSQL custom-format archives plus a SHA-256 manifest. The default operational policy is **daily backups**, **30-day age retention**, **at least 7 recent backups**, and an **absolute maximum of 35 backups**. The retention job never removes the newest `MIN_BACKUPS` entries solely because they are old.

The application image contains the PostgreSQL backup/restore scripts. Run backups from a controlled host using PostgreSQL 17 client tools and store the resulting backup directory outside the application container. Backups contain security-sensitive data and must be protected accordingly.

### Scheduled Linux deployment

The repository includes systemd units for a daily backup cycle:

```bash
sudo install -d -m 0750 /etc/pngee-cyberguard
sudo install -m 0640 deploy/backup.env.example /etc/pngee-cyberguard/backup.env
sudo install -m 0640 deploy/systemd/pngee-cyberguard-backup.service /etc/systemd/system/pngee-cyberguard-backup.service
sudo install -m 0644 deploy/systemd/pngee-cyberguard-backup.timer /etc/systemd/system/pngee-cyberguard-backup.timer
sudo systemctl daemon-reload
sudo systemctl enable --now pngee-cyberguard-backup.timer
sudo systemctl list-timers pngee-cyberguard-backup.timer
```

Adjust the service `WorkingDirectory`, `EnvironmentFile`, backup path, and service account to match the deployment host. The service is intentionally not enabled automatically by the application container.

### Offsite replication and encryption

For S3-compatible object storage, set `OFFSITE_ENABLED=true`, provision a private bucket, and provide credentials through the host's secret-management mechanism rather than committing them. `scripts/backup-offsite.sh` verifies the local SHA-256 manifest before upload and uses server-side encryption (`AES256` by default). Apply bucket versioning, restricted access, and lifecycle retention at the object-store layer.

Local backup encryption at rest remains a host/storage responsibility. Use encrypted storage or an encrypted filesystem for the local backup directory. Do not put cloud credentials or encryption keys in this repository.

### Restore / disaster recovery

Restores require an explicit `CONFIRM_RESTORE=YES` and a caller-selected `RESTORE_DATABASE_URL`; never point a test restore at production. Before a recovery operation, verify the archive checksum and confirm the target database is isolated. After restoration, run the application health, RLS, and durable integration tests. Record the restore time, backup identifier, checksum, target, and operator in the incident/change record.

The CI pipeline validates backup creation, checksum integrity, isolated database recreation, restore, and RLS integrity. Production operations should perform a full restore drill at least quarterly and retain evidence of the result.

## Endpoint agents

The endpoint agent remains separately installed on monitored Windows/Linux systems using the installers under `agent/`. The agent now requires an HTTPS `CYBERGUARD_URL` by default; `CYBERGUARD_ALLOW_INSECURE=true` is reserved for isolated development/lab use. Enroll each endpoint against the deployed API using a tenant-issued enrollment token.

## Release checks

Before promoting a deployment, require the `CyberGuard v3 CI` workflow to pass and verify `/api/health` returns a healthy database status. Confirm the backup timer is active, the backup directory is protected, and an offsite copy exists before declaring the deployment operational.
