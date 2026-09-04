import crypto from 'crypto';
import { withSecurityContext } from '../db/postgres';

export interface AgentRequest {
  enrollmentToken: string;
  hostname: string;
  os?: string;
  osVersion?: string;
  agentVersion?: string;
  macAddress?: string;
  ipAddress?: string;
  localIps?: string[];
}

export interface AgentContext {
  endpointId: string;
  agentId: string;
  organizationId: string;
  hostname: string;
  os?: string;
  osVersion?: string;
  agentVersion?: string;
}

function hash(value: string) { return crypto.createHash('sha256').update(value).digest('hex'); }
function newId(prefix: string) { return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(6).toString('hex')}`; }
function clientIp(headers: Record<string, any>, fallback?: string) {
  const forwarded = headers['x-forwarded-for'];
  return (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : undefined) || fallback || '127.0.0.1';
}

export class DurableAgentService {
  static async enroll(payload: AgentRequest) {
    if (!payload.enrollmentToken || !payload.hostname) throw new Error('Missing enrollmentToken or hostname');
    const tokenHash = hash(payload.enrollmentToken.trim());
    const deviceKey = `pngee_dev_${crypto.randomBytes(32).toString('hex')}`;
    const endpointId = newId('ep');
    const agentId = newId('agt');
    const now = new Date().toISOString();
    const primaryIp = payload.ipAddress || payload.localIps?.[0] || '127.0.0.1';

    return withSecurityContext(null, true, async client => {
      const tokenResult = await client.query(`SELECT * FROM enrollment_tokens WHERE token_hash=$1 AND revoked_at IS NULL AND expires_at>now() FOR UPDATE`, [tokenHash]);
      if (!tokenResult.rowCount) throw new Error('Invalid, revoked, or expired enrollment token.');
      const token = tokenResult.rows[0];
      if (token.used_count >= token.max_uses) throw new Error('Enrollment token usage limit reached.');

      const quota = await client.query(`SELECT count(*)::int AS count FROM assets WHERE organization_id=$1`, [token.organization_id]);
      const org = await client.query(`SELECT max_assets,name FROM organizations WHERE id=$1`, [token.organization_id]);
      if (!org.rowCount) throw new Error('Associated organization not found.');
      if (quota.rows[0].count >= org.rows[0].max_assets) throw new Error(`Endpoint quota exceeded for organization ${org.rows[0].name}.`);

      const assetPayload = { localIps: payload.localIps || [], enrolledAt: now };
      await client.query(`INSERT INTO assets (id,organization_id,hostname,ip_address,mac_address,operating_system,os_version,asset_type,criticality,status,agent_status,agent_version,security_status,telemetry,tags,last_seen,payload) VALUES ($1,$2,$3,$4,$5,$6,$7,'Windows Endpoint','HIGH','ONLINE','ACTIVE',$8,'SECURE','{}','["production-enrolled"]',$9,$10)`, [endpointId, token.organization_id, payload.hostname, primaryIp, payload.macAddress || null, payload.os || 'Unknown', payload.osVersion || 'Unknown', payload.agentVersion || null, now, JSON.stringify(assetPayload)]);
      await client.query(`INSERT INTO endpoint_identities (endpoint_id,organization_id,agent_id,agent_secret_key_hash,hostname,os,os_version,agent_version,last_ip,last_seen,last_heartbeat) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)`, [endpointId, token.organization_id, agentId, hash(deviceKey), payload.hostname, payload.os || null, payload.osVersion || null, payload.agentVersion || null, primaryIp, now]);
      await client.query(`UPDATE enrollment_tokens SET used_count=used_count+1, revoked_at=CASE WHEN used_count+1>=max_uses THEN now() ELSE revoked_at END WHERE id=$1`, [token.id]);

      const eventId = newId('evt');
      const metadata = { agentId, macAddress: payload.macAddress, os: payload.os, agentVersion: payload.agentVersion };
      const integrity = hash(`${eventId}|${token.organization_id}|${endpointId}|${now}|endpoint_enrolled|INFORMATIONAL|${JSON.stringify(metadata)}`);
      await client.query(`INSERT INTO security_events (id,organization_id,asset_id,event_type,severity,source,hostname,metadata,integrity_hash,occurred_at) VALUES ($1,$2,$3,'endpoint_enrolled','INFORMATIONAL','endpoint_agent',$4,$5,$6,$7)`, [eventId, token.organization_id, endpointId, payload.hostname, JSON.stringify(metadata), integrity, now]);
      return { endpointId, agentId, deviceKey, organizationId: token.organization_id, config: { heartbeatIntervalSeconds: 30, reportSecurityEvents: true, serverTimestamp: now } };
    });
  }

  static async authenticate(agentId: string, deviceKey: string, timestamp: string | undefined, signature: string | undefined, canonical: string) {
    if (!agentId || !deviceKey || !timestamp || !signature) throw new Error('Missing agent authentication headers.');
    const clientSec = Number(timestamp);
    if (!Number.isInteger(clientSec) || Math.abs(Math.floor(Date.now()/1000)-clientSec) > 300) throw new Error('Timestamp skew exceeds 300 seconds.');
    return withSecurityContext(null, true, async client => {
      const result = await client.query(`SELECT e.*, a.hostname AS asset_hostname, a.operating_system, a.os_version AS asset_os_version FROM endpoint_identities e JOIN assets a ON a.id=e.endpoint_id WHERE e.agent_id=$1`, [agentId]);
      if (!result.rowCount) throw new Error('Unknown agent.');
      const row = result.rows[0];
      if (hash(deviceKey) !== row.agent_secret_key_hash) throw new Error('Invalid device credential.');
      const expected = crypto.createHmac('sha256', deviceKey).update(canonical).digest('hex');
      const provided = signature.trim().toLowerCase();
      if (!/^[a-f0-9]{64}$/.test(provided) || !crypto.timingSafeEqual(Buffer.from(expected,'hex'), Buffer.from(provided,'hex'))) throw new Error('Invalid request signature.');
      return { endpointId: row.endpoint_id, agentId: row.agent_id, organizationId: row.organization_id, hostname: row.hostname, os: row.os, osVersion: row.os_version, agentVersion: row.agent_version } as AgentContext;
    });
  }

  static async claimRequest(context: AgentContext, requestId: string) {
    if (!requestId || !/^[A-Za-z0-9._:-]{8,128}$/.test(requestId)) throw new Error('Invalid X-Request-ID.');
    return withSecurityContext(context.organizationId, false, async client => {
      try { await client.query(`INSERT INTO agent_request_nonces (request_id,agent_id) VALUES ($1,$2)`, [requestId, context.agentId]); }
      catch (error: any) { if (error?.code === '23505') throw new Error('Replay detected: request ID already used.'); throw error; }
      await client.query(`DELETE FROM agent_request_nonces WHERE created_at < now() - interval '10 minutes'`);
    });
  }

  static async heartbeat(context: AgentContext, ip: string) {
    const now = new Date().toISOString();
    await withSecurityContext(context.organizationId, false, async client => {
      await client.query(`UPDATE endpoint_identities SET last_seen=$1,last_heartbeat=$1,last_ip=$2 WHERE endpoint_id=$3`, [now, ip, context.endpointId]);
      await client.query(`UPDATE assets SET last_seen=$1,status='ONLINE',agent_status='ACTIVE',ip_address=COALESCE($2,ip_address),updated_at=$1 WHERE id=$3`, [now, ip, context.endpointId]);
    });
  }

  static async system(context: AgentContext, payload: any, ip: string) {
    const now = new Date().toISOString();
    await withSecurityContext(context.organizationId, false, async client => {
      await client.query(`UPDATE endpoint_identities SET last_seen=$1,last_heartbeat=$1,last_ip=$2 WHERE endpoint_id=$3`, [now,ip,context.endpointId]);
      await client.query(`UPDATE assets SET last_seen=$1,status='ONLINE',agent_status='ACTIVE',telemetry=telemetry || $2::jsonb,updated_at=$1 WHERE id=$3`, [now, JSON.stringify({cpuUsagePercent:payload.cpuUsagePercent,ramUsagePercent:payload.ramUsagePercent,diskUsagePercent:payload.diskUsagePercent,runningProcessesCount:payload.runningProcesses,loggedInUsers:payload.loggedInUsers}), context.endpointId]);
    });
  }

  static async security(context: AgentContext, payload: any, ip: string) {
    const now = new Date().toISOString();
    await withSecurityContext(context.organizationId, false, async client => {
      const atRisk = payload.firewallEnabled === false || payload.antivirusEnabled === false;
      await client.query(`UPDATE endpoint_identities SET last_seen=$1,last_heartbeat=$1,last_ip=$2 WHERE endpoint_id=$3`, [now,ip,context.endpointId]);
      await client.query(`UPDATE assets SET last_seen=$1,status='ONLINE',agent_status='ACTIVE',security_status=$2,telemetry=telemetry || $3::jsonb,updated_at=$1 WHERE id=$4`, [now,atRisk?'AT_RISK':'SECURE',JSON.stringify({antivirusEnabled:payload.antivirusEnabled,antivirusUpToDate:payload.antivirusUpToDate,firewallEnabled:payload.firewallEnabled,missingPatchesCount:payload.missingPatchesCount,firewallProfiles:payload.firewallProfiles}),context.endpointId]);
      if (payload.firewallEnabled === false || payload.antivirusEnabled === false) {
        const eventId = newId('evt');
        const eventType = payload.firewallEnabled === false ? 'firewall_disabled' : 'defender_disabled';
        const severity = 'HIGH';
        const metadata = { ...payload, defenseImpairment: true };
        const integrity = hash(`${eventId}|${context.organizationId}|${context.endpointId}|${now}|${eventType}|${severity}|${JSON.stringify(metadata)}`);
        await client.query(`INSERT INTO security_events (id,organization_id,asset_id,event_type,severity,source,hostname,metadata,integrity_hash,occurred_at) VALUES ($1,$2,$3,$4,$5,'endpoint_agent',$6,$7,$8,$9)`, [eventId,context.organizationId,context.endpointId,eventType,severity,context.hostname,JSON.stringify(metadata),integrity,now]);
      }
    });
  }

  static async event(context: AgentContext, evt: any, ip: string) {
    const now = new Date().toISOString();
    const eventId = newId('evt');
    const severity = ['INFORMATIONAL','LOW','MEDIUM','HIGH','CRITICAL'].includes(evt.severity) ? evt.severity : 'INFORMATIONAL';
    const metadata = evt.metadata && typeof evt.metadata === 'object' ? evt.metadata : {};
    const integrity = hash(`${eventId}|${context.organizationId}|${context.endpointId}|${now}|${evt.event_type || 'generic_agent_event'}|${severity}|${JSON.stringify(metadata)}`);
    await withSecurityContext(context.organizationId, false, async client => {
      await client.query(`INSERT INTO security_events (id,organization_id,asset_id,event_type,severity,source,hostname,username,metadata,integrity_hash,occurred_at) VALUES ($1,$2,$3,$4,$5,'endpoint_agent',$6,$7,$8,$9,$10)`, [eventId,context.organizationId,context.endpointId,evt.event_type || 'generic_agent_event',severity,context.hostname,evt.username || null,JSON.stringify(metadata),integrity,evt.timestamp || now]);
      await client.query(`UPDATE endpoint_identities SET last_seen=$1,last_heartbeat=$1,last_ip=$2 WHERE endpoint_id=$3`, [now,ip,context.endpointId]);
      await client.query(`UPDATE assets SET last_seen=$1,updated_at=$1 WHERE id=$2`, [now,context.endpointId]);
    });
    return eventId;
  }

  static async listEvents(organizationId: string, limit: number, assetId?: string) {
    return withSecurityContext(organizationId, false, async client => {
      const params: any[] = [Math.min(Math.max(limit,1),500)];
      let filter = '';
      if (assetId) { params.unshift(assetId); filter = 'AND asset_id=$2'; }
      const rows = await client.query(`SELECT id AS event_id,organization_id,asset_id,occurred_at AS timestamp,source,event_type,severity,hostname,username,metadata,integrity_hash FROM security_events WHERE organization_id=$${assetId ? 2 : 1} ORDER BY occurred_at DESC LIMIT $1`, assetId ? [assetId, Math.min(Math.max(limit,1),500)] : params);
      return rows.rows;
    });
  }
}
