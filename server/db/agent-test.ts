import crypto from 'crypto';
import { pool, withSecurityContext } from './postgres';
import { DurableAgentService } from '../services/durableAgentService';

const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
const id = (prefix: string, suffix: string) => `${prefix}-agent-test-${suffix}`;

async function main() {
  const suffix = crypto.randomBytes(4).toString('hex');
  const orgId = id('org', suffix);
  const tokenId = id('token', suffix);
  const endpointId = id('ep', suffix);
  const agentId = id('agt', suffix);
  const enrollmentToken = `enroll-${crypto.randomBytes(24).toString('hex')}`;
  const licenseJti = `agent-test-license-${suffix}`;
  let enrolled: Awaited<ReturnType<typeof DurableAgentService.enroll>> | null = null;

  try {
    await withSecurityContext(null, true, async client => {
      await client.query(`INSERT INTO organizations (id,name,slug,domain,contact_email,max_assets,license_jti,license_expires_at,license_max_assets,license_features) VALUES ($1,$2,$3,'agent-test.invalid','agent@test.invalid',10,$4,now()+interval '1 hour',10,'["endpoint_protection"]')`, [orgId, 'Agent Integration Test', `agent-${suffix}`, licenseJti]);
      await client.query(`INSERT INTO enrollment_tokens (id,organization_id,token_hash,name,os_target,expires_at,max_uses) VALUES ($1,$2,$3,'Agent Test Token','all',$4,1)`, [tokenId, orgId, sha256(enrollmentToken), '2099-01-01T00:00:00Z']);
    });

    enrolled = await DurableAgentService.enroll({ enrollmentToken, hostname: `agent-${suffix}`, os: 'Linux', osVersion: 'test', agentVersion: 'test', localIps: ['192.0.2.10'] });
    if (enrolled.organizationId !== orgId || !enrolled.deviceKey) throw new Error('Enrollment did not return expected identity.');

    const requestPath = '/telemetry/heartbeat';
    const requestId = `req-${suffix}-heartbeat`;
    const body = '{}';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const canonical = `${timestamp}\nPOST\n${requestPath}\n${body}`;
    const signature = crypto.createHmac('sha256', enrolled.deviceKey).update(canonical).digest('hex');
    const context = await DurableAgentService.authenticate(enrolled.agentId, enrolled.deviceKey, timestamp, signature, canonical);
    if (context.organizationId !== orgId || context.endpointId !== enrolled.endpointId) throw new Error('Agent authentication returned incorrect tenant context.');
    await DurableAgentService.claimRequest(context, requestId);
    let replayRejected = false;
    try { await DurableAgentService.claimRequest(context, requestId); } catch { replayRejected = true; }
    if (!replayRejected) throw new Error('Replay request was accepted.');

    await DurableAgentService.heartbeat(context, '192.0.2.10');
    await DurableAgentService.system(context, { cpuUsagePercent: 10, ramUsagePercent: 20, runningProcesses: 5 }, '192.0.2.10');
    await DurableAgentService.security(context, { firewallEnabled: false, antivirusEnabled: true }, '192.0.2.10');
    const insertedEventId = await DurableAgentService.event(context, { event_type: 'agent_test_event', severity: 'MEDIUM', username: 'test-user', metadata: { test: true } }, '192.0.2.10');
    if (!insertedEventId) throw new Error('Generic event ingestion did not return an ID.');

    const own = await DurableAgentService.listEvents(orgId, 100, enrolled.endpointId);
    if (!own.some(row => row.event_id === insertedEventId)) throw new Error('Inserted event was not returned for its tenant.');
    const foreign = await DurableAgentService.listEvents('definitely-not-this-org', 100, enrolled.endpointId);
    if (foreign.length !== 0) throw new Error('Cross-tenant event visibility detected.');

    const endpoint = await withSecurityContext(orgId, false, client => client.query(`SELECT last_heartbeat,last_ip FROM endpoint_identities WHERE endpoint_id=$1`, [enrolled.endpointId]));
    if (endpoint.rowCount !== 1 || !endpoint.rows[0].last_heartbeat) throw new Error('Heartbeat persistence failed.');
    const security = await withSecurityContext(orgId, false, client => client.query(`SELECT event_type,severity FROM security_events WHERE asset_id=$1 AND event_type='firewall_disabled'`, [enrolled.endpointId]));
    if (security.rowCount !== 1 || security.rows[0].severity !== 'HIGH') throw new Error('Security telemetry detection event was not persisted.');

    console.log('[AGENT] enrollment, licensed entitlement, HMAC authentication, replay protection, telemetry persistence, and tenant isolation passed');
  } finally {
    await withSecurityContext(null, true, async client => {
      if (enrolled) {
        await client.query(`DELETE FROM security_events WHERE asset_id=$1`, [enrolled.endpointId]);
        await client.query(`DELETE FROM endpoint_identities WHERE endpoint_id=$1`, [enrolled.endpointId]);
        await client.query(`DELETE FROM assets WHERE id=$1`, [enrolled.endpointId]);
      }
      await client.query(`DELETE FROM enrollment_tokens WHERE id=$1`, [tokenId]);
      await client.query(`DELETE FROM organizations WHERE id=$1`, [orgId]);
    });
    await pool.end();
  }
}

main().catch(error => { console.error('[AGENT] test failed:', error); process.exitCode = 1; });
