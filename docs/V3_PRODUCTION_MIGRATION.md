# PNGee CyberGuard v3 Production Migration

## Purpose

This branch converts the current prototype into a production architecture without discarding the existing detection, incident, posture, and endpoint-agent business logic.

## Completed foundation

- PostgreSQL driver and connection pool.
- Transaction-scoped tenant context helper.
- PostgreSQL schema for organizations, users, sessions/tokens, assets, endpoints, enrollment tokens, events, alerts, incidents and audit logs.
- PostgreSQL RLS policies for tenant-owned data.
- Migration runner and database health check.
- Argon2id password hashing primitive.
- Signed JWT access-token verification primitive.
- Refresh-token hashing primitive.
- HTTP security headers and rate limiting.
- Production HTTPS enforcement at the application boundary.
- Production startup guard requiring PostgreSQL and an authentication secret.
- Docker deployment foundation with persistent PostgreSQL and local storage volumes.
- Normalized-event human query endpoint protected by user authentication.

## Mandatory next migration steps

### 1. Replace `server/db/store.ts`

All production API reads/writes must move from in-memory arrays to PostgreSQL repositories. The seed store must remain available only for explicit development/demo mode.

### 2. Implement real authentication

Create login, refresh, logout, password reset and MFA flows. Passwords must use Argon2id. Access tokens must be short-lived. Refresh tokens must be stored only as hashes and rotated on use.

### 3. Enforce tenant context

Every customer request must derive organization context from the authenticated identity, not from a caller-controlled organization ID. PostgreSQL RLS is the final isolation boundary.

### 4. Migrate agent identities

Enrollment tokens and endpoint credentials must be persisted in PostgreSQL. Add credential rotation/revocation and HMAC request signing over method/path/timestamp/nonce/body.

### 5. Durable telemetry

Persist normalized events in PostgreSQL and introduce an append-oriented event storage strategy. The current in-memory 5,000-event limit must not be used in production.

### 6. Real backups

Back up PostgreSQL and persistent storage. Snapshot verification must validate an actual restorable database artifact. Recovery testing must be performed against a clean PostgreSQL instance.

### 7. Licensing

Replace hard-coded license state with a signed license document verified using an embedded public key. Never ship a private signing key in the application.

### 8. Deployment

Provide Docker and native Linux installation paths. TLS should terminate at a supported reverse proxy or at the application with configured certificates. Production deployments must never expose plaintext HTTP to agents or users.

## Production gate

The product must not be labelled production-ready until all of the following are demonstrated against a clean installation:

- PostgreSQL persistence survives restart.
- Cross-tenant read/write tests fail closed.
- RLS blocks direct cross-tenant queries.
- Login and refresh-token rotation work end-to-end.
- MFA works for privileged users.
- Agent enrollment works over HTTPS.
- Agent telemetry authentication includes request integrity and replay protection.
- A customer can be backed up and restored to a clean instance.
- No demo seed data is loaded in production.
- Dependency and container vulnerability scans pass the defined release threshold.
- Build, integration and end-to-end tests pass.
