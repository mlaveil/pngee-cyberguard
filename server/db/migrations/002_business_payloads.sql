BEGIN;

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS payload jsonb NOT NULL DEFAULT '{}';
ALTER TABLE assets ADD COLUMN IF NOT EXISTS payload jsonb NOT NULL DEFAULT '{}';
ALTER TABLE security_events ADD COLUMN IF NOT EXISTS payload jsonb NOT NULL DEFAULT '{}';
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS payload jsonb NOT NULL DEFAULT '{}';
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS payload jsonb NOT NULL DEFAULT '{}';
ALTER TABLE enrollment_tokens ADD COLUMN IF NOT EXISTS payload jsonb NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS detection_rules (
  id text PRIMARY KEY,
  organization_id text REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  category text NOT NULL,
  severity text NOT NULL DEFAULT 'HIGH',
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_detection_rules_org ON detection_rules(organization_id);
ALTER TABLE detection_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE detection_rules FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS detection_rules_tenant_isolation ON detection_rules;
CREATE POLICY detection_rules_tenant_isolation ON detection_rules
  USING (organization_id IS NULL OR organization_id = current_setting('app.current_organization_id', true) OR current_setting('app.is_global_admin', true) = 'true')
  WITH CHECK (organization_id IS NULL OR organization_id = current_setting('app.current_organization_id', true) OR current_setting('app.is_global_admin', true) = 'true');

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pngee_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON detection_rules TO pngee_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pngee_app;
  END IF;
END $$;

COMMIT;
