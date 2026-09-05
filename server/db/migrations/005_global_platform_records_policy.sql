-- Global catalog/config records are intentionally readable by authenticated tenants.
-- They contain product metadata/configuration, not tenant data. Tenant-owned records
-- remain restricted to their organization by the base policy.

DROP POLICY IF EXISTS platform_records_tenant_isolation ON platform_records;
CREATE POLICY platform_records_tenant_isolation ON platform_records
  USING (
    current_setting('app.is_global_admin', true) = 'true'
    OR organization_id IS NULL
    OR organization_id::text = current_setting('app.current_organization_id', true)
  )
  WITH CHECK (
    current_setting('app.is_global_admin', true) = 'true'
    OR (organization_id IS NOT NULL AND organization_id::text = current_setting('app.current_organization_id', true))
  );
