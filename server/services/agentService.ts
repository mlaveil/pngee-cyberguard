import crypto from 'crypto';
import { db } from '../db/store';
import { Asset, EndpointIdentity, NormalizedEndpointEvent, AgentEnrollmentToken } from '../../src/types';
import { DetectionEngine } from './detectionEngine';

export interface AgentEnrollRequest {
  enrollmentToken: string;
  hostname: string;
  os: string;
  osVersion: string;
  agentVersion: string;
  macAddress?: string;
  ipAddress?: string;
  localIps?: string[];
}

export interface AgentEnrollResponse {
  endpointId: string;
  agentId: string;
  deviceKey: string;
  organizationId: string;
  config: {
    heartbeatIntervalSeconds: number;
    reportSecurityEvents: boolean;
    serverTimestamp: string;
  };
}

export interface AgentValidationResult {
  valid: boolean;
  error?: string;
  endpoint?: EndpointIdentity;
  asset?: Asset;
  organizationId?: string;
}

export class AgentService {
  /**
   * Generates a cryptographically random enrollment token, stores its SHA-256 hash,
   * and returns the raw token string once for distribution.
   */
  public static createEnrollmentToken(params: {
    organizationId: string;
    name: string;
    createdBy: string;
    osTarget?: 'windows' | 'linux' | 'macos' | 'all';
    expiresInHours?: number;
    maxUses?: number;
    isOneTimeUse?: boolean;
  }): { tokenRecord: AgentEnrollmentToken; rawToken: string } {
    const rawToken = `pngee_tok_${crypto.randomBytes(24).toString('hex')}`;
    const tokenKeyHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const tokenId = `tok-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    
    const expiresInHours = params.expiresInHours || 72; // default 3 days
    const expiresAt = new Date(Date.now() + expiresInHours * 3600 * 1000).toISOString();

    const record: AgentEnrollmentToken = {
      id: tokenId,
      organizationId: params.organizationId,
      tokenKey: rawToken, // Kept in memory/UI response
      tokenKeyHash,
      name: params.name,
      osTarget: params.osTarget || 'windows',
      createdBy: params.createdBy,
      expiresAt,
      isRevoked: false,
      usedCount: 0,
      maxUses: params.maxUses || 1,
      isOneTimeUse: params.isOneTimeUse !== undefined ? params.isOneTimeUse : true,
      createdAt: new Date().toISOString()
    };

    db.enrollmentTokens.unshift(record);

    const org = db.organizations.find(o => o.id === params.organizationId);
    db.auditLogs.unshift({
      id: `aud-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      timestamp: new Date().toISOString(),
      actor: params.createdBy,
      actorEmail: 'admin@pngeecyberguard.com',
      organizationId: params.organizationId,
      organizationName: org?.name || 'Customer Organization',
      action: 'AGENT_ENROLLMENT_TOKEN_CREATED',
      resource: 'AgentEnrollmentToken',
      resourceId: tokenId,
      result: 'SUCCESS',
      details: {
        organizationId: params.organizationId,
        tokenHash: tokenKeyHash.substring(0, 16) + '...',
        expiresAt,
        maxUses: record.maxUses
      }
    });

    return { tokenRecord: record, rawToken };
  }

  /**
   * Securely enrolls an endpoint by validating the hashed enrollment token,
   * creating an endpoint identity, and returning a device secret key.
   */
  public static enrollEndpoint(payload: AgentEnrollRequest): AgentEnrollResponse {
    if (!payload.enrollmentToken || !payload.hostname) {
      throw new Error('Missing mandatory enrollment parameters (enrollmentToken, hostname)');
    }

    // Compute incoming token hash
    const incomingHash = crypto.createHash('sha256').update(payload.enrollmentToken.trim()).digest('hex');

    // Look up token by hash or plaintext key fallback for initial seed tokens
    const token = db.enrollmentTokens.find(
      t => (t.tokenKeyHash === incomingHash || t.tokenKey === payload.enrollmentToken.trim()) && !t.isRevoked
    );

    if (!token) {
      throw new Error('Invalid or revoked enrollment token.');
    }

    // Expiry check
    if (new Date(token.expiresAt).getTime() < Date.now()) {
      throw new Error('Enrollment token has expired.');
    }

    // Usage count check
    if (token.maxUses && token.usedCount >= token.maxUses) {
      token.isRevoked = true;
      throw new Error('Enrollment token has reached maximum usage limit and is now revoked.');
    }

    // License and quota check
    const org = db.organizations.find(o => o.id === token.organizationId);
    if (!org) {
      throw new Error('Associated tenant organization not found.');
    }

    const currentOrgAssets = db.assets.filter(a => a.organizationId === token.organizationId).length;
    if (currentOrgAssets >= org.maxAssets) {
      throw new Error(`Endpoint quota exceeded for organization ${org.name} (Max: ${org.maxAssets}). Upgrade plan or remove obsolete assets.`);
    }

    // Increment token usage
    token.usedCount += 1;
    if (token.isOneTimeUse || token.usedCount >= (token.maxUses || 1)) {
      token.isRevoked = true;
    }

    // Generate unique endpoint credentials
    const endpointId = `ep-${crypto.randomBytes(8).toString('hex')}`;
    const agentId = `agt-${crypto.randomBytes(8).toString('hex')}`;
    const deviceKey = `pngee_dev_${crypto.randomBytes(32).toString('hex')}`;
    const agentSecretKeyHash = crypto.createHash('sha256').update(deviceKey).digest('hex');
    const now = new Date().toISOString();

    const primaryIp = payload.ipAddress || (payload.localIps && payload.localIps[0]) || '127.0.0.1';

    // Create Endpoint Identity
    const identity: EndpointIdentity = {
      endpointId,
      agentId,
      organizationId: token.organizationId,
      hostname: payload.hostname,
      os: payload.os || 'Windows',
      osVersion: payload.osVersion || 'Unknown',
      agentVersion: payload.agentVersion || '1.4.0',
      firstSeen: now,
      lastSeen: now,
      status: 'ONLINE',
      lastIp: primaryIp,
      lastHeartbeat: now,
      enrollmentTimestamp: now,
      agentSecretKeyHash
    };

    db.endpointIdentities.unshift(identity);

    // Create or link Asset
    const newAsset: Asset = {
      id: endpointId,
      organizationId: token.organizationId,
      hostname: payload.hostname,
      ipAddress: primaryIp,
      macAddress: payload.macAddress || '00:00:00:00:00:00',
      operatingSystem: payload.os || 'Microsoft Windows',
      osVersion: payload.osVersion || '10.0',
      assetType: 'Windows Endpoint',
      criticality: 'HIGH',
      status: 'ONLINE',
      lastSeen: now,
      agentStatus: 'ACTIVE',
      agentVersion: payload.agentVersion || '1.4.0',
      securityStatus: 'SECURE',
      tags: ['production-enrolled', 'agent-v1.4'],
      telemetry: {
        antivirusEnabled: true,
        antivirusUpToDate: true,
        firewallEnabled: true,
        missingPatchesCount: 0,
        runningProcessesCount: 65,
        loggedInUsers: []
      },
      createdAt: now,
      updatedAt: now
    };

    db.assets.unshift(newAsset);

    // Normalize and log enrollment event
    this.recordNormalizedEvent({
      organization_id: token.organizationId,
      asset_id: endpointId,
      event_type: 'endpoint_enrolled',
      severity: 'INFORMATIONAL',
      hostname: payload.hostname,
      metadata: {
        agentId,
        macAddress: payload.macAddress,
        os: payload.os,
        agentVersion: payload.agentVersion
      }
    });

    db.auditLogs.unshift({
      id: `aud-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      timestamp: now,
      actor: 'agent-enrollment',
      actorEmail: 'agent@telemetry.pngee.internal',
      organizationId: token.organizationId,
      organizationName: org.name,
      action: 'ENDPOINT_ENROLLED_SUCCESSFULLY',
      resource: 'Endpoint',
      resourceId: endpointId,
      result: 'SUCCESS',
      details: {
        agentId,
        hostname: payload.hostname,
        organizationId: token.organizationId,
        ip: primaryIp
      }
    });

    return {
      endpointId,
      agentId,
      deviceKey,
      organizationId: token.organizationId,
      config: {
        heartbeatIntervalSeconds: 30,
        reportSecurityEvents: true,
        serverTimestamp: now
      }
    };
  }

  /**
   * Authenticates incoming agent telemetry requests using agent ID, device key,
   * and checks timestamp skew against replay attacks.
   */
  public static validateAgentCredential(
    agentId?: string,
    deviceKey?: string,
    timestampHeader?: string
  ): AgentValidationResult {
    if (!agentId || !deviceKey) {
      return { valid: false, error: 'Missing agent authentication headers (X-Agent-ID, X-Agent-Key)' };
    }

    // Replay attack prevention: check timestamp skew (+/- 300 seconds)
    if (timestampHeader) {
      const clientSec = parseInt(timestampHeader, 10);
      if (!isNaN(clientSec)) {
        const currentSec = Math.floor(Date.now() / 1000);
        const skew = Math.abs(currentSec - clientSec);
        if (skew > 300) {
          return { valid: false, error: `Timestamp skew too large (${skew}s > 300s limit). Replay protection triggered.` };
        }
      }
    }

    const endpoint = db.endpointIdentities.find(e => e.agentId === agentId);
    if (!endpoint) {
      return { valid: false, error: 'Unknown or un-enrolled Agent ID.' };
    }

    const incomingKeyHash = crypto.createHash('sha256').update(deviceKey).digest('hex');
    const expectedKeyHash = endpoint.agentSecretKeyHash;

    const hashMatch = crypto.timingSafeEqual(
      Buffer.from(incomingKeyHash, 'utf-8'),
      Buffer.from(expectedKeyHash, 'utf-8')
    );

    if (!hashMatch) {
      return { valid: false, error: 'Invalid device secret key credential.' };
    }

    const asset = db.assets.find(a => a.id === endpoint.endpointId);

    return {
      valid: true,
      endpoint,
      asset,
      organizationId: endpoint.organizationId
    };
  }

  /**
   * Normalizes an endpoint event into standard schema and appends it to immutable chain.
   */
  public static recordNormalizedEvent(params: {
    organization_id: string;
    asset_id: string;
    event_type: string;
    severity: 'INFORMATIONAL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    hostname: string;
    username?: string;
    metadata?: Record<string, any>;
  }): NormalizedEndpointEvent {
    const timestamp = new Date().toISOString();
    const event_id = `evt-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    // SHA-256 integrity hash chaining
    const hashPayload = `${db.lastIntegrityHash}|${event_id}|${params.organization_id}|${params.asset_id}|${timestamp}|${params.event_type}|${params.severity}|${JSON.stringify(params.metadata || {})}`;
    const integrity_hash = crypto.createHash('sha256').update(hashPayload).digest('hex');
    db.lastIntegrityHash = integrity_hash;

    const normalized: NormalizedEndpointEvent = {
      event_id,
      organization_id: params.organization_id,
      asset_id: params.asset_id,
      timestamp,
      source: 'endpoint_agent',
      source_vendor: 'PNGee',
      event_type: params.event_type,
      severity: params.severity,
      hostname: params.hostname,
      username: params.username,
      metadata: params.metadata || {},
      integrity_hash
    };

    db.normalizedEvents.unshift(normalized);

    // Keep memory footprint bounded while strictly retaining latest 5000 events
    if (db.normalizedEvents.length > 5000) {
      db.normalizedEvents.length = 5000;
    }

    return normalized;
  }

  /**
   * Processes agent heartbeat
   */
  public static processHeartbeat(endpoint: EndpointIdentity, asset?: Asset, ip?: string) {
    const now = new Date().toISOString();
    endpoint.lastSeen = now;
    endpoint.lastHeartbeat = now;
    endpoint.status = 'ONLINE';
    if (ip) endpoint.lastIp = ip;

    if (asset) {
      asset.lastSeen = now;
      asset.status = 'ONLINE';
      asset.agentStatus = 'ACTIVE';
      if (ip && ip !== '127.0.0.1') asset.ipAddress = ip;
    }
  }

  /**
   * Processes system metrics
   */
  public static processSystemMetrics(endpoint: EndpointIdentity, asset: Asset | undefined, payload: any) {
    this.processHeartbeat(endpoint, asset);

    if (asset) {
      asset.telemetry = {
        ...asset.telemetry,
        cpuUsagePercent: payload.cpuUsagePercent,
        ramUsagePercent: payload.ramUsagePercent,
        diskUsagePercent: payload.diskUsagePercent,
        runningProcessesCount: payload.runningProcesses || asset.telemetry?.runningProcessesCount,
        loggedInUsers: payload.loggedInUsers || asset.telemetry?.loggedInUsers
      };
      asset.updatedAt = new Date().toISOString();
    }
  }

  /**
   * Processes security telemetry (Firewall, Defender, Updates).
   * Automatically detects and fires alerts if defenses are disabled!
   */
  public static processSecurityMetrics(endpoint: EndpointIdentity, asset: Asset | undefined, payload: any) {
    this.processHeartbeat(endpoint, asset);

    if (asset) {
      asset.telemetry = {
        ...asset.telemetry,
        antivirusEnabled: payload.antivirusEnabled,
        antivirusUpToDate: payload.antivirusUpToDate,
        firewallEnabled: payload.firewallEnabled,
        missingPatchesCount: payload.missingPatchesCount
      };

      if (!payload.firewallEnabled || !payload.antivirusEnabled) {
        asset.securityStatus = 'AT_RISK';
      } else {
        asset.securityStatus = 'SECURE';
      }
      asset.updatedAt = new Date().toISOString();
    }

    // Scenario 1: Windows Firewall Disabled Check
    if (payload.firewallEnabled === false) {
      const normEvt = this.recordNormalizedEvent({
        organization_id: endpoint.organizationId,
        asset_id: endpoint.endpointId,
        event_type: 'firewall_disabled',
        severity: 'HIGH',
        hostname: endpoint.hostname,
        metadata: {
          profiles: payload.firewallProfiles,
          details: 'Windows Firewall profile(s) were tampered with or disabled.'
        }
      });

      DetectionEngine.ingestAndCorrelate({
        organizationId: endpoint.organizationId,
        source: 'PNGee Windows Agent',
        sourceType: 'ENDPOINT_AGENT',
        severity: 'HIGH',
        eventCategory: 'Endpoint',
        host: endpoint.hostname,
        eventDescription: `CRITICAL DEFENSE IMPAIRMENT: Windows Firewall disabled on host ${endpoint.hostname}. Host exposed to unauthorized network reconnaissance.`,
        mitreTechnique: 'T1562.001 (Impair Defenses: Disable Windows Firewall)',
        rawEventReference: `endpoint_event_id=${normEvt.event_id} type=firewall_disabled`
      });
    }

    // Scenario 2: Microsoft Defender Disabled Check
    if (payload.antivirusEnabled === false) {
      const normEvt = this.recordNormalizedEvent({
        organization_id: endpoint.organizationId,
        asset_id: endpoint.endpointId,
        event_type: 'defender_disabled',
        severity: 'HIGH',
        hostname: endpoint.hostname,
        metadata: {
          realTimeProtection: payload.realTimeProtection,
          details: 'Microsoft Defender Real-Time Protection or Antivirus service was disabled.'
        }
      });

      DetectionEngine.ingestAndCorrelate({
        organizationId: endpoint.organizationId,
        source: 'PNGee Windows Agent',
        sourceType: 'ENDPOINT_AGENT',
        severity: 'HIGH',
        eventCategory: 'Endpoint',
        host: endpoint.hostname,
        eventDescription: `CRITICAL DEFENSE IMPAIRMENT: Microsoft Defender Antivirus disabled on host ${endpoint.hostname}. Host real-time malware protection is inactive.`,
        mitreTechnique: 'T1562.001 (Impair Defenses: Disable Tools)',
        rawEventReference: `endpoint_event_id=${normEvt.event_id} type=defender_disabled`
      });
    }
  }

  /**
   * Watchdog checking endpoints for heartbeat timeouts (> 90 seconds without a heartbeat).
   * Flags endpoint as OFFLINE and raises alert.
   */
  public static checkHeartbeatTimeouts(): { offlineCount: number; newlyOffline: string[] } {
    const now = Date.now();
    const timeoutThresholdMs = 90 * 1000; // 90 seconds timeout
    const newlyOffline: string[] = [];

    for (const ep of db.endpointIdentities) {
      const lastHbTime = new Date(ep.lastHeartbeat).getTime();
      const elapsed = now - lastHbTime;

      if (elapsed > timeoutThresholdMs && ep.status === 'ONLINE') {
        ep.status = 'OFFLINE';
        newlyOffline.push(ep.hostname);

        const asset = db.assets.find(a => a.id === ep.endpointId);
        if (asset) {
          asset.status = 'OFFLINE';
          asset.agentStatus = 'INACTIVE';
          asset.updatedAt = new Date().toISOString();
        }

        // Record normalized offline event
        this.recordNormalizedEvent({
          organization_id: ep.organizationId,
          asset_id: ep.endpointId,
          event_type: 'endpoint_offline',
          severity: 'HIGH',
          hostname: ep.hostname,
          metadata: {
            lastHeartbeat: ep.lastHeartbeat,
            elapsedSeconds: Math.floor(elapsed / 1000)
          }
        });

        // Scenario 4: Endpoint stops communicating -> Generate High Alert
        DetectionEngine.ingestAndCorrelate({
          organizationId: ep.organizationId,
          source: 'PNGee Watchdog Service',
          sourceType: 'ENDPOINT_AGENT',
          severity: 'HIGH',
          eventCategory: 'Endpoint',
          host: ep.hostname,
          eventDescription: `Endpoint Communication Loss: Agent on ${ep.hostname} has ceased transmitting heartbeats (>90s elapsed). Host is now OFFLINE.`,
          mitreTechnique: 'T1562 (Defense Evasion / Network Severance)',
          rawEventReference: `endpoint_id=${ep.endpointId} watchdog=heartbeat_timeout`
        });
      }
    }

    return {
      offlineCount: db.endpointIdentities.filter(e => e.status === 'OFFLINE').length,
      newlyOffline
    };
  }
}
