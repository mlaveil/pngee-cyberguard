BEGIN;

CREATE TABLE IF NOT EXISTS agent_request_nonces (
  request_id text PRIMARY KEY,
  agent_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agent_request_nonces_created ON agent_request_nonces(created_at);

ALTER TABLE agent_request_nonces ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_request_nonces FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agent_request_nonces_tenant_isolation ON agent_request_nonces;
CREATE POLICY agent_request_nonces_tenant_isolation ON agent_request_nonces
  USING (agent_id IN (SELECT agent_id FROM endpoint_identities WHERE organization_id = current_setting('app.current_organization_id', true)) OR current_setting('app.is_global_admin', true) = 'true')
  WITH CHECK (agent_id IN (SELECT agent_id FROM endpoint_identities WHERE organization_id = current_setting('app.current_organization_id', true)) OR current_setting('app.is_global_admin', true) = 'true');

GRANT SELECT, INSERT, DELETE ON agent_request_nonces TO pngee_app;

CREATE INDEX IF NOT EXISTS idx_endpoint_identities_org ON endpoint_identities(organization_id);
CREATE INDEX IF NOT EXISTS idx_endpoint_identities_agent ON endpoint_identities(agent_id);
CREATE INDEX IF NOT EXISTS idx_events_asset_time ON security_events(asset_id, occurred_at DESC);

COMMIT;
