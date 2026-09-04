BEGIN;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS license_token text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS license_jti text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS license_expires_at timestamptz;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS license_max_assets integer;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS license_features jsonb NOT NULL DEFAULT '[]';
CREATE INDEX IF NOT EXISTS idx_org_license_expiry ON organizations(license_expires_at);
COMMIT;
