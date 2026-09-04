BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'ACTIVE',
  max_assets integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('PNGEE_SUPER_ADMIN','PNGEE_SECURITY_ANALYST','CUSTOMER_ADMIN','CUSTOMER_USER')),
  status text NOT NULL DEFAULT 'ACTIVE',
  mfa_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  replaced_by uuid REFERENCES refresh_tokens(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  hostname text NOT NULL,
  ip_address inet,
  mac_address macaddr,
  operating_system text,
  os_version text,
  asset_type text NOT NULL,
  criticality text NOT NULL DEFAULT 'MEDIUM',
  status text NOT NULL DEFAULT 'UNKNOWN',
  agent_status text,
  agent_version text,
  security_status text,
  telemetry jsonb NOT NULL DEFAULT '{}',
  tags jsonb NOT NULL DEFAULT '[]',
  last_seen timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS endpoint_identities (
  endpoint_id uuid PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id text NOT NULL UNIQUE,
  agent_secret_key_hash text NOT NULL,
  hostname text NOT NULL,
  os text,
  os_version text,
  agent_version text,
  last_ip inet,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  last_heartbeat timestamptz
);

CREATE TABLE IF NOT EXISTS enrollment_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  name text NOT NULL,
  os_target text NOT NULL DEFAULT 'all',
  created_by uuid REFERENCES users(id),
  expires_at timestamptz NOT NULL,
  max_uses integer NOT NULL DEFAULT 1,
  used_count integer NOT NULL DEFAULT 0,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  asset_id uuid REFERENCES assets(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  severity text NOT NULL,
  source text NOT NULL,
  hostname text,
  username text,
  metadata jsonb NOT NULL DEFAULT '{}',
  integrity_hash text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  asset_id uuid REFERENCES assets(id) ON DELETE SET NULL,
  severity text NOT NULL,
  status text NOT NULL DEFAULT 'OPEN',
  title text NOT NULL,
  description text,
  rule_id text,
  occurrence_count integer NOT NULL DEFAULT 1,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'DETECTED',
  severity text NOT NULL,
  related_alert_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource text NOT NULL,
  resource_id text,
  result text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}',
  ip_address inet,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_assets_org ON assets(organization_id);
CREATE INDEX IF NOT EXISTS idx_events_org_time ON security_events(organization_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_org_status ON alerts(organization_id, status, last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_org_status ON incidents(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_org_time ON audit_logs(organization_id, created_at DESC);

-- Application roles should be created by the deployment operator and granted only the privileges required.
-- RLS uses a transaction-local tenant setting populated by withTenant().
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE endpoint_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollment_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_tenant_isolation ON users;
CREATE POLICY users_tenant_isolation ON users
  USING (organization_id::text = current_setting('app.current_organization_id', true));

DROP POLICY IF EXISTS assets_tenant_isolation ON assets;
CREATE POLICY assets_tenant_isolation ON assets
  USING (organization_id::text = current_setting('app.current_organization_id', true));

DROP POLICY IF EXISTS endpoint_tenant_isolation ON endpoint_identities;
CREATE POLICY endpoint_tenant_isolation ON endpoint_identities
  USING (organization_id::text = current_setting('app.current_organization_id', true));

DROP POLICY IF EXISTS enrollment_tenant_isolation ON enrollment_tokens;
CREATE POLICY enrollment_tenant_isolation ON enrollment_tokens
  USING (organization_id::text = current_setting('app.current_organization_id', true));

DROP POLICY IF EXISTS events_tenant_isolation ON security_events;
CREATE POLICY events_tenant_isolation ON security_events
  USING (organization_id::text = current_setting('app.current_organization_id', true));

DROP POLICY IF EXISTS alerts_tenant_isolation ON alerts;
CREATE POLICY alerts_tenant_isolation ON alerts
  USING (organization_id::text = current_setting('app.current_organization_id', true));

DROP POLICY IF EXISTS incidents_tenant_isolation ON incidents;
CREATE POLICY incidents_tenant_isolation ON incidents
  USING (organization_id::text = current_setting('app.current_organization_id', true));

DROP POLICY IF EXISTS audit_tenant_isolation ON audit_logs;
CREATE POLICY audit_tenant_isolation ON audit_logs
  USING (organization_id::text = current_setting('app.current_organization_id', true));

COMMIT;
