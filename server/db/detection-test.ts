import { pool, query, withSecurityContext } from './postgres';
import { ingestAndCorrelateDurably } from '../services/durableDetectionEngine';

const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const orgA = `det-test-a-${suffix}`;
const orgB = `det-test-b-${suffix}`;
const assetA = `det-asset-a-${suffix}`;
const ruleThreshold = `det-rule-threshold-${suffix}`;
const rulePowerShell = `det-rule-powershell-${suffix}`;

async function main() {
  try {
    await withSecurityContext(null, true, async client => {
      await client.query(`INSERT INTO organizations (id,name,slug,domain,contact_email,max_assets) VALUES ($1,$2,$3,'detection-test.invalid','detection@test.invalid',10),($4,$5,$6,'detection-test-b.invalid','detection-b@test.invalid',10)`, [orgA, 'Detection Test A', `${orgA}-slug`, orgB, 'Detection Test B', `${orgB}-slug`]);
      await client.query(`INSERT INTO assets (id,organization_id,hostname,ip_address,operating_system,os_version,asset_type,criticality,status) VALUES ($1,$2,'det-test-host','10.77.0.10','Linux','test','Endpoint','HIGH','ONLINE')`, [assetA, orgA]);
      await client.query(`INSERT INTO detection_rules (id,organization_id,name,enabled,category,severity,payload) VALUES ($1,$2,'Repeated authentication failures',true,'AUTHENTICATION','HIGH',$3),($4,$2,'Suspicious PowerShell execution',true,'ENDPOINT','HIGH','{}')`, [ruleThreshold, orgA, JSON.stringify({ threshold: 2, timeWindowMinutes: 10 }), rulePowerShell]);
    });

    const first = await ingestAndCorrelateDurably({
      organizationId: orgA, source: 'test-sensor', sourceType: 'AUTH', severity: 'MEDIUM',
      eventCategory: 'AUTHENTICATION', host: 'det-test-host', sourceIP: '10.77.0.20', username: 'alice',
      eventDescription: 'Failed authentication attempt'
    });
    if (first.generatedAlert) throw new Error('Threshold rule triggered before threshold was reached');

    const second = await ingestAndCorrelateDurably({
      organizationId: orgA, source: 'test-sensor', sourceType: 'AUTH', severity: 'MEDIUM',
      eventCategory: 'AUTHENTICATION', host: 'det-test-host', sourceIP: '10.77.0.20', username: 'alice',
      eventDescription: 'Failed authentication attempt'
    });
    if (!second.generatedAlert || second.isDeduplicated) throw new Error('Threshold detection did not generate a new alert');

    const duplicate = await ingestAndCorrelateDurably({
      organizationId: orgA, source: 'test-sensor', sourceType: 'AUTH', severity: 'MEDIUM',
      eventCategory: 'AUTHENTICATION', host: 'det-test-host', sourceIP: '10.77.0.20', username: 'alice',
      eventDescription: 'Failed authentication attempt'
    });
    if (!duplicate.generatedAlert || !duplicate.isDeduplicated || Number(duplicate.generatedAlert.occurrenceCount) < 2) {
      throw new Error('Alert deduplication/occurrence counting failed');
    }

    const correlated = await ingestAndCorrelateDurably({
      organizationId: orgA, source: 'test-sensor', sourceType: 'PROCESS', severity: 'HIGH',
      eventCategory: 'ENDPOINT', host: 'det-test-host', username: 'alice',
      eventDescription: 'Suspicious PowerShell execution detected', mitreTechnique: 'T1059.001'
    });
    if (!correlated.generatedAlert) throw new Error('PowerShell detection did not generate an alert');
    if (!correlated.correlatedIncident) throw new Error('High-severity alerts were not correlated into an incident');
    if (!correlated.correlatedIncident.relatedAlertIds?.includes(second.generatedAlert.id)) throw new Error('Incident is missing the prior related alert');

    const tenantIsolation = await withSecurityContext(orgB, false, async client => {
      const alerts = await client.query(`SELECT id FROM alerts WHERE organization_id=$1`, [orgA]);
      const incidents = await client.query(`SELECT id FROM incidents WHERE organization_id=$1`, [orgA]);
      const events = await client.query(`SELECT id FROM security_events WHERE organization_id=$1`, [orgA]);
      return { alerts: alerts.rowCount, incidents: incidents.rowCount, events: events.rowCount };
    });
    if (tenantIsolation.alerts !== 0 || tenantIsolation.incidents !== 0 || tenantIsolation.events !== 0) throw new Error('Detection data crossed tenant RLS boundary');

    console.log('Durable detection tests passed: threshold, alert creation, deduplication, incident correlation, tenant isolation.');
  } finally {
    await withSecurityContext(null, true, async client => {
      await client.query(`DELETE FROM security_events WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
      await client.query(`DELETE FROM alerts WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
      await client.query(`DELETE FROM incidents WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
      await client.query(`DELETE FROM detection_rules WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
      await client.query(`DELETE FROM assets WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
      await client.query(`DELETE FROM organizations WHERE id IN ($1,$2)`, [orgA, orgB]);
    });
    await pool.end();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
