import { randomBytes } from 'crypto';
import { pool, withSecurityContext } from './postgres';

async function main() {
  const suffix = randomBytes(4).toString('hex');
  const orgId = `test-durable-${suffix}`;
  const assetId = `ast-durable-${suffix}`;
  const eventId = `evt-durable-${suffix}`;
  const alertId = `alt-durable-${suffix}`;
  const incidentId = `inc-durable-${suffix}`;
  const ruleId = `rule-durable-${suffix}`;

  try {
    await withSecurityContext(null, true, async client => {
      await client.query(`INSERT INTO organizations (id,name,slug,domain,contact_email,payload) VALUES ($1,$2,$3,'test.invalid','test@test.invalid',$4)`, [orgId, 'Durable Test Org', `durable-${suffix}`, JSON.stringify({ test: true })]);
      await client.query(`INSERT INTO detection_rules (id,organization_id,name,category,severity,payload) VALUES ($1,$2,'Durable Test Rule','Endpoint','HIGH',$3)`, [ruleId, orgId, JSON.stringify({ threshold: 1 })]);
      await client.query(`INSERT INTO assets (id,organization_id,hostname,asset_type,status,agent_status,payload) VALUES ($1,$2,'durable-test-host','SERVER','ONLINE','ACTIVE',$3)`, [assetId, orgId, JSON.stringify({ test: true })]);
      await client.query(`INSERT INTO security_events (id,organization_id,asset_id,event_type,severity,source,metadata,payload) VALUES ($1,$2,$3,'Endpoint','HIGH','durable-test',$4,$5)`, [eventId, orgId, assetId, JSON.stringify({ test: true }), JSON.stringify({ eventDescription: 'durable test event' })]);
      await client.query(`INSERT INTO alerts (id,organization_id,asset_id,severity,status,title,rule_id,payload) VALUES ($1,$2,$3,'HIGH','NEW','Durable Test Alert',$4,$5)`, [alertId, orgId, assetId, ruleId, JSON.stringify({ test: true })]);
      await client.query(`INSERT INTO incidents (id,organization_id,title,status,severity,related_alert_ids,payload) VALUES ($1,$2,'Durable Test Incident','DETECTED','HIGH',$3,$4)`, [incidentId, orgId, JSON.stringify([alertId]), JSON.stringify({ test: true })]);
    });

    const tenantRows = await withSecurityContext(orgId, false, client => client.query(`SELECT a.id AS asset_id,e.id AS event_id,al.id AS alert_id,i.id AS incident_id,r.id AS rule_id FROM assets a JOIN security_events e ON e.asset_id=a.id JOIN alerts al ON al.asset_id=a.id JOIN incidents i ON $1 = ANY(SELECT jsonb_array_elements_text(i.related_alert_ids)) JOIN detection_rules r ON r.id=$2 WHERE a.id=$3`, [alertId, ruleId, assetId]));
    if (tenantRows.rowCount !== 1) throw new Error('Durable tenant CRUD verification failed');

    await withSecurityContext('definitely-not-this-org', false, async client => {
      const hidden = await client.query(`SELECT id FROM assets WHERE id=$1`, [assetId]);
      if (hidden.rowCount !== 0) throw new Error('Durable tenant isolation failed');
    });

    console.log('[DURABLE] business PostgreSQL CRUD and RLS isolation passed');
  } finally {
    await withSecurityContext(null, true, async client => {
      await client.query(`DELETE FROM incidents WHERE id=$1`, [incidentId]);
      await client.query(`DELETE FROM alerts WHERE id=$1`, [alertId]);
      await client.query(`DELETE FROM security_events WHERE id=$1`, [eventId]);
      await client.query(`DELETE FROM assets WHERE id=$1`, [assetId]);
      await client.query(`DELETE FROM detection_rules WHERE id=$1`, [ruleId]);
      await client.query(`DELETE FROM organizations WHERE id=$1`, [orgId]);
    });
    await pool.end();
  }
}

main().catch(error => { console.error('[DURABLE] test failed:', error); process.exitCode = 1; });
