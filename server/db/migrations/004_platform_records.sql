-- V3 step 1: durable storage for remaining platform resources that are not
-- represented by first-class relational tables yet. This table is tenant-scoped
-- and protected by the same PostgreSQL RLS boundary as the core entities.

CREATE TABLE IF NOT EXISTS platform_records (
  id TEXT PRIMARY KEY,
  organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  record_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_records_org_type_updated
  ON platform_records (organization_id, record_type, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_records_type_updated
  ON platform_records (record_type, updated_at DESC);

ALTER TABLE platform_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_records FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_records_tenant_isolation ON platform_records;
CREATE POLICY platform_records_tenant_isolation ON platform_records
  USING (
    current_setting('app.is_global_admin', true) = 'true'
    OR organization_id::text = current_setting('app.current_organization_id', true)
  )
  WITH CHECK (
    current_setting('app.is_global_admin', true) = 'true'
    OR organization_id::text = current_setting('app.current_organization_id', true)
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON platform_records TO pngee_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON platform_records TO pngee_migrator;

ALTER DEFAULT PRIVILEGES FOR ROLE pngee_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pngee_app;
