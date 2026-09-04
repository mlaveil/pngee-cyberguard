import crypto from 'crypto';
import { db } from '../db/store';
import { SecurityEvent, SecurityAlert, DetectionRule, SecurityIncident } from '../../src/types';

export interface IngestTelemetryPayload {
  organizationId: string;
  source: string;
  sourceType: SecurityEvent['sourceType'];
  severity: SecurityEvent['severity'];
  eventCategory: SecurityEvent['eventCategory'];
  sourceIP?: string;
  destinationIP?: string;
  username?: string;
  host?: string;
  device?: string;
  eventDescription: string;
  rawEventReference?: string;
  mitreTechnique?: string;
}

export interface IngestResult {
  event: SecurityEvent;
  generatedAlert?: SecurityAlert;
  isDeduplicated?: boolean;
  correlatedIncident?: SecurityIncident;
}

export class DetectionEngine {
  private static DEDUPLICATION_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
  private static INCIDENT_CORRELATION_WINDOW_MS = 60 * 60 * 1000; // 60 minutes

  public static ingestAndCorrelate(payload: IngestTelemetryPayload): IngestResult {
    const timestamp = new Date().toISOString();
    const eventId = `evt-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    // 1. Normalize Event into Canonical Security Event
    const newEvent: SecurityEvent = {
      id: eventId,
      organizationId: payload.organizationId,
      timestamp,
      source: payload.source,
      sourceType: payload.sourceType,
      severity: payload.severity,
      eventCategory: payload.eventCategory,
      sourceIP: payload.sourceIP,
      destinationIP: payload.destinationIP,
      username: payload.username,
      host: payload.host,
      device: payload.device,
      eventDescription: payload.eventDescription,
      rawEventReference: payload.rawEventReference || `normalized_source="${payload.source}" type="${payload.sourceType}"`,
      mitreTechnique: payload.mitreTechnique,
      status: 'PROCESSED',
      createdTimestamp: timestamp
    };

    // Append to security events store
    db.securityEvents.unshift(newEvent);

    // 2. Identify Matching Asset
    const matchingAsset = db.assets.find(a =>
      a.organizationId === payload.organizationId &&
      (a.hostname.toLowerCase() === (payload.host || '').toLowerCase() ||
       a.ipAddress === payload.sourceIP ||
       a.ipAddress === payload.destinationIP)
    );

    // 3. Evaluate Active Backend Detection Rules
    const activeRules = db.detectionRules.filter(
      r => r.enabled && (r.organizationScope === 'GLOBAL' || r.organizationScope === payload.organizationId)
    );

    let triggeredRule: DetectionRule | undefined;

    for (const rule of activeRules) {
      // Direct Rule Matches based on description / MITRE technique / category
      if (payload.mitreTechnique && payload.mitreTechnique.includes('T1562') && rule.id === 'rule-av-disabled') {
        triggeredRule = rule;
        break;
      }
      if (payload.eventDescription.toLowerCase().includes('firewall') && rule.category === 'Endpoint') {
        triggeredRule = rule;
        break;
      }
      if (payload.eventDescription.toLowerCase().includes('powershell') && rule.id === 'rule-suspicious-powershell') {
        triggeredRule = rule;
        break;
      }

      // Category & Threshold evaluation
      if (rule.category === payload.eventCategory) {
        if (payload.severity === 'CRITICAL' || payload.severity === 'HIGH') {
          triggeredRule = rule;
          break;
        }

        // Evaluate event count within time window
        const windowMs = rule.timeWindowMinutes * 60 * 1000;
        const now = Date.now();
        const matchingEvents = db.securityEvents.filter(e =>
          e.organizationId === payload.organizationId &&
          e.eventCategory === rule.category &&
          new Date(e.timestamp).getTime() >= (now - windowMs) &&
          (!payload.username || e.username === payload.username) &&
          (!payload.sourceIP || e.sourceIP === payload.sourceIP)
        );

        if (matchingEvents.length >= rule.threshold) {
          triggeredRule = rule;
          break;
        }
      }
    }

    let generatedAlert: SecurityAlert | undefined;
    let isDeduplicated = false;
    let correlatedIncident: SecurityIncident | undefined;

    if (triggeredRule) {
      newEvent.detectionRuleId = triggeredRule.id;
      newEvent.status = 'CORRELATED';

      const targetHost = matchingAsset?.hostname || payload.host || 'unknown-host';
      const deduplicationKey = `${payload.organizationId}:${triggeredRule.id}:${targetHost.toLowerCase()}`;

      // 4. Alert Deduplication Engine: Prevent Alert Storms
      const nowMs = Date.now();
      const existingAlert = db.alerts.find(a =>
        a.organizationId === payload.organizationId &&
        a.deduplicationKey === deduplicationKey &&
        a.status !== 'RESOLVED' &&
        a.status !== 'SUPPRESSED' &&
        (nowMs - new Date(a.lastSeenTimestamp || a.timestamp).getTime()) < this.DEDUPLICATION_WINDOW_MS
      );

      if (existingAlert) {
        // DEDUPLICATE: Update existing alert instead of creating a new one
        existingAlert.occurrenceCount = (existingAlert.occurrenceCount || 1) + 1;
        existingAlert.lastSeenTimestamp = timestamp;
        if (!existingAlert.relatedEventIds.includes(newEvent.id)) {
          existingAlert.relatedEventIds.unshift(newEvent.id);
          if (existingAlert.relatedEventIds.length > 25) {
            existingAlert.relatedEventIds.length = 25;
          }
        }
        if (!existingAlert.analystNotes) existingAlert.analystNotes = [];
        existingAlert.analystNotes.push(
          `[${timestamp.substring(0, 19)}Z] Deduplicated: Re-occurrence detected (Total events: ${existingAlert.occurrenceCount}).`
        );
        existingAlert.evidence = `Detection rule "${triggeredRule.name}" triggered ${existingAlert.occurrenceCount} times on ${targetHost}. Latest event: ${payload.eventDescription}`;

        generatedAlert = existingAlert;
        isDeduplicated = true;
      } else {
        // CREATE NEW ALERT
        const alertId = `alt-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
        generatedAlert = {
          id: alertId,
          organizationId: payload.organizationId,
          title: `${triggeredRule.name} on ${targetHost}`,
          severity: triggeredRule.severity,
          status: 'NEW',
          detectionRuleId: triggeredRule.id,
          detectionRuleName: triggeredRule.name,
          assetId: matchingAsset?.id,
          assetHostname: targetHost,
          username: payload.username,
          timestamp,
          evidence: `Detection rule "${triggeredRule.name}" triggered: ${payload.eventDescription}`,
          relatedEventIds: [newEvent.id],
          recommendedAction: `Inspect event telemetry from source ${payload.source}. Verify host integrity on ${targetHost}.`,
          assignedAnalystId: 'usr-pngee-analyst-1',
          assignedAnalystName: 'Elena Rostova (SOC Tier 2)',
          occurrenceCount: 1,
          lastSeenTimestamp: timestamp,
          deduplicationKey,
          analystNotes: [
            `[${timestamp.substring(0, 19)}Z] PNGee Detection Engine fired alert from rule ${triggeredRule.id}.`
          ],
          createdAt: timestamp
        };

        db.alerts.unshift(generatedAlert);
      }

      // 5. Automated Incident Correlation Engine
      if (generatedAlert.severity === 'CRITICAL' || generatedAlert.severity === 'HIGH') {
        // Look for an existing open incident for this tenant & host within correlation window
        const openIncident = db.incidents.find(i =>
          i.organizationId === payload.organizationId &&
          i.status !== 'CLOSED' &&
          (i.affectedAssetHostnames.includes(targetHost) || i.affectedAssetIds.includes(matchingAsset?.id || '')) &&
          (nowMs - new Date(i.updatedAt).getTime()) < this.INCIDENT_CORRELATION_WINDOW_MS
        );

        if (openIncident) {
          // Link alert to existing incident
          generatedAlert.linkedIncidentId = openIncident.id;
          if (!openIncident.relatedAlertIds.includes(generatedAlert.id)) {
            openIncident.relatedAlertIds.push(generatedAlert.id);
          }
          if (!openIncident.relatedEventIds.includes(newEvent.id)) {
            openIncident.relatedEventIds.push(newEvent.id);
          }
          openIncident.timeline.unshift({
            id: `tml-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
            timestamp,
            actor: 'PNGee Detection Correlation Engine',
            action: 'ALERT_CORRELATED_TO_INCIDENT',
            description: `Correlated Alert ${generatedAlert.id} ("${generatedAlert.title}") into active incident.`,
            type: 'SYSTEM'
          });
          openIncident.updatedAt = timestamp;
          correlatedIncident = openIncident;
        } else {
          // Check if there are other recent critical alerts on this host to form a new incident
          const recentCriticalAlerts = db.alerts.filter(a =>
            a.organizationId === payload.organizationId &&
            a.assetHostname === targetHost &&
            (a.severity === 'CRITICAL' || a.severity === 'HIGH') &&
            !a.linkedIncidentId &&
            a.id !== generatedAlert?.id &&
            (nowMs - new Date(a.createdAt).getTime()) < this.INCIDENT_CORRELATION_WINDOW_MS
          );

          if (recentCriticalAlerts.length >= 1 || (generatedAlert.occurrenceCount && generatedAlert.occurrenceCount >= 3)) {
            // Auto-Correlate into a new Security Incident
            const incId = `inc-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
            const relatedAlerts = recentCriticalAlerts.length > 0 ? [generatedAlert, ...recentCriticalAlerts] : [generatedAlert];
            const incidentTitle = recentCriticalAlerts.length > 0 
              ? `Multi-Stage Security Incident on ${targetHost}`
              : `Persistent Attack Campaign (${generatedAlert.occurrenceCount} occurrences) on ${targetHost}`;

            const newIncident: SecurityIncident = {
              id: incId,
              organizationId: payload.organizationId,
              title: incidentTitle,
              description: `Automated Incident Correlation: Multiple High/Critical severity security alerts observed on ${targetHost} within correlation window.`,
              severity: 'HIGH',
              status: 'DETECTED',
              assignedAnalystId: 'usr-pngee-analyst-1',
              assignedAnalystName: 'Elena Rostova (SOC Tier 2)',
              affectedAssetIds: matchingAsset ? [matchingAsset.id] : [],
              affectedAssetHostnames: [targetHost],
              relatedAlertIds: relatedAlerts.map(a => a.id),
              relatedEventIds: [newEvent.id],
              timeline: [
                {
                  id: `tml-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
                  timestamp,
                  actor: 'PNGee Correlation Engine',
                  action: 'INCIDENT_AUTO_CORRELATED',
                  description: `Correlated ${relatedAlerts.length} alerts into unified incident on host ${targetHost}.`,
                  type: 'SYSTEM'
                }
              ],
              evidence: [
                `Correlated alerts: ${relatedAlerts.map(a => a.title).join(' | ')}`
              ],
              notes: [
                `System identified multiple security indicators on host ${targetHost}. SOC triage initiated.`
              ],
              actionsTaken: ['Automated SOC Notification dispatched', 'Host flagged AT_RISK'],
              createdAt: timestamp,
              updatedAt: timestamp
            };

            db.incidents.unshift(newIncident);

            // Link alerts
            relatedAlerts.forEach(a => {
              a.linkedIncidentId = incId;
            });

            correlatedIncident = newIncident;
          }
        }
      }
    }

    return {
      event: newEvent,
      generatedAlert,
      isDeduplicated,
      correlatedIncident
    };
  }
}
