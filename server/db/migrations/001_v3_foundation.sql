BEGIN;

CREATE TABLE IF NOT EXISTS organizations (id text PRIMARY KEY, name text NOT NULL, slug text NOT NULL UNIQUE, domain text NOT NULL DEFAULT '', contact_email text NOT NULL DEFAULT '', contact_phone text, address text, plan text NOT NULL DEFAULT 'PNGEE_BUSINESS', status text NOT NULL DEFAULT 'ACTIVE', max_assets integer NOT NULL DEFAULT 100, assigned_analysts jsonb NOT NULL DEFAULT '[]', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS users (id text PRIMARY KEY, organization_id text REFERENCES organizations(id) ON DELETE CASCADE, email text NOT NULL UNIQUE, name text NOT NULL, password_hash text NOT NULL, role text NOT NULL CHECK (role IN ('PNGEE_SUPER_ADMIN','PNGEE_SECURITY_ANALYST','CUSTOMER_ADMIN','CUSTOMER_USER','STK_SUPER_ADMIN','STK_SECURITY_ANALYST')), avatar_url text, phone text, status text NOT NULL DEFAULT 'ACTIVE', mfa_enabled boolean NOT NULL DEFAULT false, last_login_at timestamptz, last_login_ip inet, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS refresh_tokens (id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL, revoked_at timestamptz, replaced_by text REFERENCES refresh_tokens(id), created_ip inet, user_agent text, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS assets (id text PRIMARY KEY, organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, hostname text NOT NULL, ip_address inet, mac_address macaddr, operating_system text, os_version text, asset_type text NOT NULL, criticality text NOT NULL DEFAULT 'MEDIUM', status text NOT NULL DEFAULT 'UNMANAGED', agent_status text, agent_version text, security_status text, telemetry jsonb NOT NULL DEFAULT '{}', tags jsonb NOT NULL DEFAULT '[]', notes text, last_seen timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS endpoint_identities (endpoint_id text PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE, organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, agent_id text NOT NULL UNIQUE, agent_secret_key_hash text NOT NULL, hostname text NOT NULL, os text, os_version text, agent_version text, last_ip inet, first_seen timestamptz NOT NULL DEFAULT now(), last_seen timestamptz NOT NULL DEFAULT now(), last_heartbeat timestamptz);
CREATE TABLE IF NOT EXISTS enrollment_tokens (id text PRIMARY KEY, organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, token_hash text NOT NULL UNIQUE, name text NOT NULL, os_target text NOT NULL DEFAULT 'all', created_by text REFERENCES users(id), expires_at timestamptz NOT NULL, max_uses integer NOT NULL DEFAULT 1, used_count integer NOT NULL DEFAULT 0, revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS security_events (id text PRIMARY KEY, organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, asset_id text REFERENCES assets(id) ON DELETE SET NULL, event_type text NOT NULL, severity text NOT NULL, source text NOT NULL, hostname text, username text, metadata jsonb NOT NULL DEFAULT '{}', integrity_hash text, occurred_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS alerts (id text PRIMARY KEY, organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, asset_id text REFERENCES assets(id) ON DELETE SET NULL, severity text NOT NULL, status text NOT NULL DEFAULT 'NEW', title text NOT NULL, description text, rule_id text, occurrence_count integer NOT NULL DEFAULT 1, first_seen timestamptz NOT NULL DEFAULT now(), last_seen timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS incidents (id text PRIMARY KEY, organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, title text NOT NULL, status text NOT NULL DEFAULT 'DETECTED', severity text NOT NULL, related_alert_ids jsonb NOT NULL DEFAULT '[]', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS audit_logs (id text PRIMARY KEY, organization_id text REFERENCES organizations(id) ON DELETE SET NULL, actor_user_id text REFERENCES users(id) ON DELETE SET NULL, action text NOT NULL, resource text NOT NULL, resource_id text, result text NOT NULL, details jsonb NOT NULL DEFAULT '{}', ip_address inet, created_at timestamptz NOT NULL DEFAULT now());

CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_assets_org ON assets(organization_id);
CREATE INDEX IF NOT EXISTS idx_events_org_time ON security_events(organization_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_org_status ON alerts(organization_id, status, last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_org_status ON incidents(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_org_time ON audit_logs(organization_id, created_at DESC);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE endpoint_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollment_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_tenant_isolation ON organizations USING (id = current_setting('app.current_organization_id', true) OR current_setting('app.is_global_admin', true) = 'true');
CREATE POLICY users_tenant_isolation ON users USING (organization_id = current_setting('app.current_organization_id', true) OR current_setting('app.is_global_admin', true) = 'true');
CREATE POLICY assets_tenant_isolation ON assets USING (organization_id = current_setting('app.current_organization_id', true) OR current_setting('app.is_global_admin', true) = 'true');
CREATE POLICY endpoint_tenant_isolation ON endpoint_identities USING (organization_id = current_setting('app.current_organization_id', true) OR current_setting('app.is_global_admin', true) = 'true');
CREATE POLICY enrollment_tenant_isolation ON enrollment_tokens USING (organization_id = current_setting('app.current_organization_id', true) OR current_setting('app.is_global_admin', true) = 'true');
CREATE POLICY events_tenant_isolation ON security_events USING (organization_id = current_setting('app.current_organization_id', true) OR current_setting('app.is_global_admin', true) = 'true');
CREATE POLICY alerts_tenant_isolation ON alerts USING (organization_id = current_setting('app.current_organization_id', true) OR current_setting('app.is_global_admin', true) = 'true');
CREATE POLICY incidents_tenant_isolation ON incidents USING (organization_id = current_setting('app.current_organization_id', true) OR current_setting('app.is_global_admin', true) = 'true');
CREATE POLICY audit_tenant_isolation ON audit_logs USING (organization_id = current_setting('app.current_organization_id', true) OR current_setting('app.is_global_admin', true) = 'true');

ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE assets FORCE ROW LEVEL SECURITY;
ALTER TABLE endpoint_identities FORCE ROW LEVEL SECURITY;
ALTER TABLE enrollment_tokens FORCE ROW LEVEL SECURITY;
ALTER TABLE security_events FORCE ROW LEVEL SECURITY;
ALTER TABLE alerts FORCE ROW LEVEL SECURITY;
ALTER TABLE incidents FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pngee_app') THEN
    GRANT USAGE ON SCHEMA public TO pngee_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO pngee_app;
    GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO pngee_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pngee_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO pngee_app;
  END IF;
END $$;

COMMIT;
