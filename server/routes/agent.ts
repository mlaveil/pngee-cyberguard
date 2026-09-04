import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { AgentService } from '../services/agentService';
import { db } from '../db/store';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';

export const agentRouter = Router();

agentRouter.get('/agent/scripts/:scriptName', (req: Request, res: Response) => {
  const { scriptName } = req.params;
  const safeName = path.basename(scriptName);
  const filePath = path.join(process.cwd(), 'public', 'agents', 'windows', safeName);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'Agent script not found' });
    return;
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.sendFile(filePath);
});

agentRouter.post('/agent/enroll', (req: Request, res: Response) => {
  try {
    const { enrollmentToken, hostname, os, osVersion, agentVersion, macAddress, ipAddress, localIps } = req.body;
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || ipAddress || '127.0.0.1';
    const result = AgentService.enrollEndpoint({ enrollmentToken, hostname, os, osVersion, agentVersion, macAddress, ipAddress: clientIp, localIps });
    res.status(201).json(result);
  } catch (error: any) {
    res.status(400).json({ error: 'Enrollment Failed', message: error.message || 'Invalid enrollment payload or token' });
  }
});

function agentAuth(req: Request, res: Response, next: () => void) {
  const agentId = (req.headers['x-agent-id'] as string) || (req.body?.agentId as string);
  const deviceKey = (req.headers['x-agent-key'] as string) || (req.body?.deviceKey as string);
  const timestampHeader = req.headers['x-timestamp'] as string;
  const validation = AgentService.validateAgentCredential(agentId, deviceKey, timestampHeader);
  if (!validation.valid) {
    res.status(401).json({ error: 'Unauthorized Agent', message: validation.error || 'Agent authentication failed' });
    return;
  }
  (req as any).agentEndpoint = validation.endpoint;
  (req as any).agentAsset = validation.asset;
  (req as any).agentOrgId = validation.organizationId;
  next();
}

agentRouter.post('/telemetry/heartbeat', agentAuth, (req: Request, res: Response) => {
  const endpoint = (req as any).agentEndpoint;
  const asset = (req as any).agentAsset;
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
  AgentService.processHeartbeat(endpoint, asset, clientIp);
  res.json({ status: 'ACKNOWLEDGED', timestamp: new Date().toISOString(), nextHeartbeatSeconds: 30 });
});

agentRouter.post('/telemetry/system', agentAuth, (req: Request, res: Response) => {
  AgentService.processSystemMetrics((req as any).agentEndpoint, (req as any).agentAsset, req.body);
  res.json({ status: 'RECORDED', timestamp: new Date().toISOString() });
});

agentRouter.post('/telemetry/security', agentAuth, (req: Request, res: Response) => {
  const asset = (req as any).agentAsset;
  AgentService.processSecurityMetrics((req as any).agentEndpoint, asset, req.body);
  res.json({ status: 'RECORDED', securityStatus: asset?.securityStatus || 'SECURE', timestamp: new Date().toISOString() });
});

agentRouter.post('/telemetry/services', agentAuth, (req: Request, res: Response) => {
  const endpoint = (req as any).agentEndpoint;
  const services = req.body?.services || [];
  const winDefend = services.find((s: any) => s.name === 'WinDefend');
  if (winDefend && winDefend.status !== 'Running') {
    AgentService.processSecurityMetrics(endpoint, (req as any).agentAsset, { antivirusEnabled: false, realTimeProtection: false });
  }
  const mpsSvc = services.find((s: any) => s.name === 'MpsSvc');
  if (mpsSvc && mpsSvc.status !== 'Running') {
    AgentService.processSecurityMetrics(endpoint, (req as any).agentAsset, { firewallEnabled: false, firewallProfiles: { domain: false, private: false, public: false } });
  }
  res.json({ status: 'RECORDED', evaluatedServicesCount: services.length });
});

agentRouter.post('/telemetry/events', agentAuth, (req: Request, res: Response) => {
  const endpoint = (req as any).agentEndpoint;
  const events = Array.isArray(req.body) ? req.body : [req.body];
  const processedEvents = events.map((evt: any) => AgentService.recordNormalizedEvent({
    organization_id: endpoint.organizationId,
    asset_id: endpoint.endpointId,
    event_type: evt.event_type || 'generic_agent_event',
    severity: evt.severity || 'INFORMATIONAL',
    hostname: endpoint.hostname,
    username: evt.username,
    metadata: evt.metadata || {}
  }).event_id);
  res.json({ status: 'INGESTED', count: processedEvents.length, eventIds: processedEvents });
});

// Human/SOC access only. Agent credentials are intentionally not accepted here.
agentRouter.get('/telemetry/normalized-events', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
  const requestedOrg = req.query.orgId as string | undefined;
  const orgId = req.user?.role === 'CUSTOMER_ADMIN' || req.user?.role === 'CUSTOMER_USER'
    ? req.user.organizationId
    : (requestedOrg || req.targetOrgId || 'all');

  let list = db.normalizedEvents;
  if (orgId !== 'all') list = list.filter(e => e.organization_id === orgId);

  res.json({ events: list.slice(0, limit), totalCount: list.length, lastIntegrityHash: db.lastIntegrityHash });
});
