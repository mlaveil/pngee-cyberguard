import crypto from 'crypto';
import { withSecurityContext } from '../db/postgres';

const DEDUPLICATION_WINDOW_MS = 30 * 60 * 1000;
const INCIDENT_CORRELATION_WINDOW_MS = 60 * 60 * 1000;

export interface DurableDetectionPayload {
  organizationId: string;
  source: string;
  sourceType?: string;
  severity?: string;
  eventCategory: string;
  sourceIP?: string;
  destinationIP?: string;
  username?: string;
  host?: string;
  device?: string;
  eventDescription: string;
  rawEventReference?: string;
  mitreTechnique?: string;
  assetId?: string;
}

function merge(row: any, base: Record<string, any>) {
  return { ...base, ...(row.payload && typeof row.payload === 'object' ? row.payload : {}) };
}

export async function ingestAndCorrelateDurably(payload: DurableDetectionPayload) {
  const timestamp = new Date().toISOString();
  const eventId = `evt-${Date.now()}-${crypto.randomBytes(5).toString('hex')}`;
  const severity = payload.severity || 'MEDIUM';
  const sourceType = payload.sourceType || 'FIREWALL';

  return withSecurityContext(payload.organizationId, false, async client => {
    const assetResult = await client.query(
      `SELECT * FROM assets WHERE ($1::text IS NOT NULL AND id=$1) OR (hostname ILIKE $2 OR ip_address::text=$3 OR ip_address::text=$4) ORDER BY CASE WHEN id=$1 THEN 0 ELSE 1 END LIMIT 1`,
      [payload.assetId || null, payload.host || '', payload.sourceIP || '', payload.destinationIP || '']
    );
    const asset = assetResult.rows[0];

    const eventPayload = {
      id: eventId,
      organizationId: payload.organizationId,
      timestamp,
      source: payload.source,
      sourceType,
      severity,
      eventCategory: payload.eventCategory,
      sourceIP: payload.sourceIP,
      destinationIP: payload.destinationIP,
      username: payload.username,
      host: payload.host,
      device: payload.device,
      eventDescription: payload.eventDescription,
      rawEventReference: payload.rawEventReference || `normalized_source="${payload.source}" type="${sourceType}"`,
      mitreTechnique: payload.mitreTechnique,
      status: 'PROCESSED',
      createdTimestamp: timestamp,
      assetId: asset?.id
    };

    await client.query(
      `INSERT INTO security_events (id,organization_id,asset_id,event_type,severity,source,hostname,username,metadata,occurred_at,created_at,payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10,$11)`,
      [eventId, payload.organizationId, asset?.id || null, payload.eventCategory, severity, payload.source, payload.host || asset?.hostname || null, payload.username || null, JSON.stringify({ sourceType, sourceIP: payload.sourceIP, destinationIP: payload.destinationIP, mitreTechnique: payload.mitreTechnique, eventDescription: payload.eventDescription }), timestamp, JSON.stringify(eventPayload)]
    );

    const rules = await client.query(`SELECT * FROM detection_rules WHERE enabled=true AND (organization_id IS NULL OR organization_id=$1) ORDER BY created_at ASC`, [payload.organizationId]);
    let triggered: any = null;
    for (const rule of rules.rows) {
      const rulePayload = rule.payload || {};
      if (payload.mitreTechnique?.includes('T1562') && rule.id === 'rule-av-disabled') { triggered = rule; break; }
      if (payload.eventDescription.toLowerCase().includes('firewall') && String(rule.category).toLowerCase() === 'endpoint') { triggered = rule; break; }
      if (payload.eventDescription.toLowerCase().includes('powershell') && rule.id === 'rule-suspicious-powershell') { triggered = rule; break; }
      if (String(rule.category).toLowerCase() === payload.eventCategory.toLowerCase()) {
        if (severity === 'CRITICAL' || severity === 'HIGH') { triggered = rule; break; }
        const windowMinutes = Number(rulePayload.timeWindowMinutes || rulePayload.timeWindow || 5);
        const threshold = Number(rulePayload.threshold || 5);
        const count = await client.query(
          `SELECT count(*)::int AS count FROM security_events WHERE organization_id=$1 AND event_type=$2 AND occurred_at >= now() - ($3::text || ' minutes')::interval AND ($4::text IS NULL OR username=$4) AND ($5::text IS NULL OR (metadata->>'sourceIP')=$5)`,
          [payload.organizationId, payload.eventCategory, String(windowMinutes), payload.username || null, payload.sourceIP || null]
        );
        if (Number(count.rows[0].count) >= threshold) { triggered = rule; break; }
      }
    }

    let alert: any = null;
    let deduplicated = false;
    let incident: any = null;

    if (triggered) {
      const targetHost = asset?.hostname || payload.host || 'unknown-host';
      const deduplicationKey = `${payload.organizationId}:${triggered.id}:${targetHost.toLowerCase()}`;
      const existing = await client.query(
        `SELECT * FROM alerts WHERE organization_id=$1 AND status NOT IN ('RESOLVED','SUPPRESSED') AND last_seen >= now() - interval '30 minutes' AND payload->>'deduplicationKey'=$2 ORDER BY last_seen DESC LIMIT 1`,
        [payload.organizationId, deduplicationKey]
      );
      if (existing.rowCount) {
        const row = existing.rows[0];
        const nextPayload = { ...(row.payload || {}), occurrenceCount: Number(row.occurrence_count || 1) + 1, lastSeenTimestamp: timestamp, relatedEventIds: [...new Set([eventId, ...((row.payload || {}).relatedEventIds || [])])].slice(0,25), deduplicationKey };
        const updated = await client.query(`UPDATE alerts SET occurrence_count=occurrence_count+1,last_seen=$2,payload=$3 WHERE id=$1 RETURNING *`, [row.id,timestamp,JSON.stringify(nextPayload)]);
        alert = updated.rows[0];
        deduplicated = true;
      } else {
        const alertId = `alt-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
        const alertPayload = {
          id: alertId, organizationId: payload.organizationId, title: `${triggered.name} on ${targetHost}`, severity: triggered.severity || severity, status: 'NEW', detectionRuleId: triggered.id, detectionRuleName: triggered.name, assetId: asset?.id, assetHostname: targetHost, username: payload.username, timestamp, evidence: `Detection rule "${triggered.name}" triggered: ${payload.eventDescription}`, relatedEventIds: [eventId], recommendedAction: `Inspect event telemetry from source ${payload.source}. Verify host integrity on ${targetHost}.`, occurrenceCount: 1, lastSeenTimestamp: timestamp, deduplicationKey, createdAt: timestamp
        };
        const created = await client.query(`INSERT INTO alerts (id,organization_id,asset_id,severity,status,title,description,rule_id,payload) VALUES ($1,$2,$3,$4,'NEW',$5,$6,$7,$8) RETURNING *`, [alertId,payload.organizationId,asset?.id || null,alertPayload.severity,alertPayload.title,alertPayload.evidence,triggered.id,JSON.stringify(alertPayload)]);
        alert = created.rows[0];
      }

      if (alert && (alert.severity === 'CRITICAL' || alert.severity === 'HIGH')) {
        const recent = await client.query(`SELECT * FROM alerts WHERE organization_id=$1 AND asset_id IS NOT DISTINCT FROM $2 AND severity IN ('CRITICAL','HIGH') AND created_at >= now() - interval '60 minutes' AND id<>$3 ORDER BY created_at DESC`, [payload.organizationId, asset?.id || null, alert.id]);
        const open = await client.query(`SELECT * FROM incidents WHERE organization_id=$1 AND status<>'CLOSED' AND updated_at >= now() - interval '60 minutes' AND payload->>'assetHostname'=$2 ORDER BY updated_at DESC LIMIT 1`, [payload.organizationId,targetHost]);
        if (open.rowCount) {
          incident = open.rows[0];
          const nextAlerts = [...new Set([...(incident.related_alert_ids || []), alert.id])];
          const nextPayload = { ...(incident.payload || {}), assetHostname: targetHost, relatedEventIds: [...new Set([eventId,...((incident.payload||{}).relatedEventIds||[])])] };
          const updated = await client.query(`UPDATE incidents SET related_alert_ids=$2,updated_at=$3,payload=$4 WHERE id=$1 RETURNING *`, [incident.id,JSON.stringify(nextAlerts),timestamp,JSON.stringify(nextPayload)]);
          incident = updated.rows[0];
          await client.query(`UPDATE alerts SET payload=payload || $2::jsonb WHERE id=$1`, [alert.id,JSON.stringify({linkedIncidentId:incident.id})]);
        } else if (recent.rowCount || Number(alert.occurrence_count) >= 3) {
          const incidentId = `inc-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
          const related = [alert.id, ...recent.rows.map((r:any)=>r.id)];
          const incidentPayload = { id:incidentId, organizationId:payload.organizationId, title: recent.rowCount ? `Multi-Stage Security Incident on ${targetHost}` : `Persistent Attack Campaign (${alert.occurrence_count} occurrences) on ${targetHost}`, description:`Automated correlation detected multiple high-severity indicators on ${targetHost}.`, severity:'HIGH',status:'DETECTED',affectedAssetIds:asset?.id?[asset.id]:[],affectedAssetHostnames:[targetHost],relatedAlertIds:related,relatedEventIds:[eventId],createdAt:timestamp,updatedAt:timestamp,assetHostname:targetHost };
          const created = await client.query(`INSERT INTO incidents (id,organization_id,title,status,severity,related_alert_ids,payload,created_at,updated_at) VALUES ($1,$2,$3,'DETECTED','HIGH',$4,$5,$6,$6) RETURNING *`, [incidentId,payload.organizationId,incidentPayload.title,JSON.stringify(related),JSON.stringify(incidentPayload),timestamp]);
          incident=created.rows[0];
          await client.query(`UPDATE alerts SET payload=payload || $2::jsonb WHERE id=ANY($1::text[])`, [related,JSON.stringify({linkedIncidentId:incidentId})]);
        }
      }
    }

    const eventRow = await client.query(`SELECT * FROM security_events WHERE id=$1`, [eventId]);
    return {
      event: merge(eventRow.rows[0], eventPayload),
      generatedAlert: alert ? merge(alert,{id:alert.id,organizationId:alert.organization_id,severity:alert.severity,status:alert.status,title:alert.title,description:alert.description,detectionRuleId:alert.rule_id,occurrenceCount:alert.occurrence_count,timestamp:alert.first_seen,lastSeenTimestamp:alert.last_seen,createdAt:alert.created_at}) : undefined,
      isDeduplicated: deduplicated,
      correlatedIncident: incident ? merge(incident,{id:incident.id,organizationId:incident.organization_id,title:incident.title,status:incident.status,severity:incident.severity,relatedAlertIds:incident.related_alert_ids,createdAt:incident.created_at,updatedAt:incident.updated_at}) : undefined
    };
  });
}
