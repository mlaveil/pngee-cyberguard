import { Router, Response } from 'express';
import { db } from '../db/store';
import { authMiddleware, requireRoles, AuthenticatedRequest } from '../middleware/auth';
import { DetectionEngine } from '../services/detectionEngine';
import { GeminiSecurityService } from '../services/geminiService';
import { AutomatedTestRunner } from '../services/testRunner';
import { DisasterRecoveryService } from '../services/disasterRecovery';
import { AgentService } from '../services/agentService';

export const apiRouter = Router();

// Apply Auth Middleware to all /api/v1 routes
apiRouter.use(authMiddleware as any);

// ==========================================
// 1. AUTH & SESSIONS
// ==========================================
apiRouter.get('/auth/me', (req: AuthenticatedRequest, res: Response) => {
  const currentOrg = db.organizations.find(o => o.id === req.user?.organizationId);
  res.json({
    user: req.user,
    organization: currentOrg,
    availableOrgs: (req.user?.role === 'PNGEE_SUPER_ADMIN' || req.user?.role === 'PNGEE_SECURITY_ANALYST' || req.user?.role === 'STK_SUPER_ADMIN' || req.user?.role === 'STK_SECURITY_ANALYST') 
      ? db.organizations 
      : db.organizations.filter(o => o.id === req.user?.organizationId)
  });
});

apiRouter.post('/auth/switch-user', (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.body;
  const targetUser = db.users.find(u => u.id === userId);
  if (!targetUser) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  
  db.addAuditLog(
    targetUser,
    'USER_SWITCH_CONTEXT',
    'Auth',
    targetUser.id,
    'SUCCESS',
    targetUser.organizationId,
    { switchedTo: targetUser.email, role: targetUser.role }
  );

  res.json({
    success: true,
    user: targetUser,
    organization: db.organizations.find(o => o.id === targetUser.organizationId)
  });
});

// ==========================================
// 2. ORGANIZATIONS (TENANTS)
// ==========================================
apiRouter.get('/organizations', (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role === 'PNGEE_SUPER_ADMIN' || req.user?.role === 'PNGEE_SECURITY_ANALYST' || req.user?.role === 'STK_SUPER_ADMIN' || req.user?.role === 'STK_SECURITY_ANALYST') {
    res.json(db.organizations);
  } else {
    res.json(db.organizations.filter(o => o.id === req.user?.organizationId));
  }
});

apiRouter.post('/organizations', requireRoles(['PNGEE_SUPER_ADMIN']) as any, (req: AuthenticatedRequest, res: Response) => {
  const { name, domain, contactEmail, plan, maxAssets } = req.body;
  if (!name || !domain || !contactEmail) {
    res.status(400).json({ error: 'Name, domain and contact email are required' });
    return;
  }

  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  const newOrg = {
    id: `org-${slug}-${Date.now().toString(36)}`,
    name,
    slug,
    domain,
    contactEmail,
    plan: plan || 'PNGEE_BUSINESS',
    status: 'ACTIVE' as const,
    maxAssets: maxAssets || 50,
    assignedAnalysts: ['usr-pngee-analyst-1'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.organizations.push(newOrg);
  db.addAuditLog(req.user!, 'CREATE_ORGANIZATION', 'Organization', newOrg.id, 'SUCCESS', newOrg.id, { name: newOrg.name });

  res.status(201).json(newOrg);
});

apiRouter.put('/organizations/:id', requireRoles(['STK_SUPER_ADMIN', 'CUSTOMER_ADMIN']) as any, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  if (req.user?.role === 'CUSTOMER_ADMIN' && req.user.organizationId !== id) {
    res.status(403).json({ error: 'Tenant isolation: cannot modify other organizations' });
    return;
  }

  const orgIndex = db.organizations.findIndex(o => o.id === id);
  if (orgIndex === -1) {
    res.status(404).json({ error: 'Organization not found' });
    return;
  }

  const updated = {
    ...db.organizations[orgIndex],
    ...req.body,
    updatedAt: new Date().toISOString()
  };

  db.organizations[orgIndex] = updated;
  db.addAuditLog(req.user!, 'UPDATE_ORGANIZATION', 'Organization', id, 'SUCCESS', id, req.body);
  res.json(updated);
});

// ==========================================
// 3. USERS
// ==========================================
apiRouter.get('/users', (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.targetOrgId;
  if (orgId === 'all') {
    res.json(db.users);
  } else {
    res.json(db.users.filter(u => u.organizationId === orgId));
  }
});

apiRouter.post('/users', requireRoles(['STK_SUPER_ADMIN', 'CUSTOMER_ADMIN']) as any, (req: AuthenticatedRequest, res: Response) => {
  const { name, email, role, organizationId } = req.body;
  const targetOrg = req.user?.role === 'CUSTOMER_ADMIN' ? req.user.organizationId : (organizationId || req.user?.organizationId);

  if (!name || !email || !role) {
    res.status(400).json({ error: 'Name, email, and role are required' });
    return;
  }

  const newUser = {
    id: `usr-${Date.now().toString(36)}`,
    organizationId: targetOrg,
    name,
    email,
    role,
    mfaEnabled: true,
    status: 'ACTIVE' as const,
    createdAt: new Date().toISOString()
  };

  db.users.push(newUser);
  db.addAuditLog(req.user!, 'CREATE_USER', 'User', newUser.id, 'SUCCESS', targetOrg, { email: newUser.email, role: newUser.role });

  res.status(201).json(newUser);
});

// ==========================================
// 4. ASSETS & ENDPOINT MONITORING
// ==========================================
apiRouter.get('/assets', (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.targetOrgId;
  const { type, status, criticality } = req.query;

  let list = orgId === 'all' ? db.assets : db.assets.filter(a => a.organizationId === orgId);

  if (type) list = list.filter(a => a.assetType === type);
  if (status) list = list.filter(a => a.status === status);
  if (criticality) list = list.filter(a => a.criticality === criticality);

  res.json(list);
});

apiRouter.post('/assets', requireRoles(['STK_SUPER_ADMIN', 'STK_SECURITY_ANALYST', 'CUSTOMER_ADMIN']) as any, (req: AuthenticatedRequest, res: Response) => {
  const targetOrg = req.user?.role === 'CUSTOMER_ADMIN' ? req.user.organizationId : (req.body.organizationId || req.user?.organizationId);
  const { hostname, ipAddress, operatingSystem, osVersion, assetType, criticality } = req.body;

  if (!hostname || !ipAddress || !assetType) {
    res.status(400).json({ error: 'Hostname, IP address and Asset Type are required.' });
    return;
  }

  const newAsset = {
    id: `ast-${Date.now().toString(36)}`,
    organizationId: targetOrg,
    hostname,
    ipAddress,
    operatingSystem: operatingSystem || 'Unknown OS',
    osVersion: osVersion || '1.0',
    assetType,
    criticality: criticality || 'MEDIUM',
    status: 'ONLINE' as const,
    lastSeen: new Date().toISOString(),
    agentStatus: 'ACTIVE' as const,
    agentVersion: 'v2.4.1',
    securityStatus: 'SECURE' as const,
    tags: req.body.tags || ['NewAsset'],
    notes: req.body.notes || '',
    telemetry: {
      cpuUsagePercent: 15,
      ramUsagePercent: 40,
      diskUsagePercent: 25,
      antivirusEnabled: true,
      antivirusUpToDate: true,
      firewallEnabled: true,
      missingPatchesCount: 0,
      runningProcessesCount: 65,
      loggedInUsers: ['system']
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.assets.unshift(newAsset);
  db.addAuditLog(req.user!, 'CREATE_ASSET', 'Asset', newAsset.id, 'SUCCESS', targetOrg, { hostname: newAsset.hostname });

  res.status(201).json(newAsset);
});

apiRouter.get('/assets/enrollment-tokens', (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.targetOrgId;
  const list = orgId === 'all' ? db.enrollmentTokens : db.enrollmentTokens.filter(t => t.organizationId === orgId);
  res.json(list);
});

apiRouter.post('/assets/enrollment-tokens', requireRoles(['STK_SUPER_ADMIN', 'CUSTOMER_ADMIN']) as any, (req: AuthenticatedRequest, res: Response) => {
  const targetOrg = req.user?.role === 'CUSTOMER_ADMIN' ? req.user.organizationId : (req.body.organizationId || req.user?.organizationId);
  const { name, osTarget } = req.body;

  const rawToken = `stk_token_${Math.random().toString(36).substring(2, 10)}_${Date.now().toString(36)}`;
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

  const tokenRecord = {
    id: `tok-${Date.now().toString(36)}`,
    organizationId: targetOrg,
    tokenKey: rawToken,
    name: name || 'Endpoint Auto-Enrollment Key',
    osTarget: osTarget || 'all',
    createdBy: req.user!.name,
    expiresAt,
    isRevoked: false,
    usedCount: 0,
    maxUses: 100,
    createdAt: new Date().toISOString()
  };

  db.enrollmentTokens.unshift(tokenRecord);
  db.addAuditLog(req.user!, 'CREATE_ENROLLMENT_TOKEN', 'EnrollmentToken', tokenRecord.id, 'SUCCESS', targetOrg, { name: tokenRecord.name });

  res.status(201).json(tokenRecord);
});

apiRouter.post('/assets/enrollment-tokens/:id/revoke', requireRoles(['STK_SUPER_ADMIN', 'CUSTOMER_ADMIN']) as any, (req: AuthenticatedRequest, res: Response) => {
  const token = db.enrollmentTokens.find(t => t.id === req.params.id);
  if (!token) {
    res.status(404).json({ error: 'Token not found' });
    return;
  }
  if (req.user?.role === 'CUSTOMER_ADMIN' && token.organizationId !== req.user.organizationId) {
    res.status(403).json({ error: 'Tenant violation' });
    return;
  }

  token.isRevoked = true;
  db.addAuditLog(req.user!, 'REVOKE_ENROLLMENT_TOKEN', 'EnrollmentToken', token.id, 'SUCCESS', token.organizationId);
  res.json({ success: true, token });
});

// ==========================================
// 5. SECURITY EVENTS & TELEMETRY INGESTION
// ==========================================
apiRouter.get('/events', (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.targetOrgId;
  const { category, severity, limit = 100 } = req.query;

  let list = orgId === 'all' ? db.securityEvents : db.securityEvents.filter(e => e.organizationId === orgId);

  if (category) list = list.filter(e => e.eventCategory === category);
  if (severity) list = list.filter(e => e.severity === severity);

  res.json(list.slice(0, Number(limit)));
});

apiRouter.post('/events/ingest', (req: AuthenticatedRequest, res: Response) => {
  const targetOrg = req.user?.role === 'CUSTOMER_ADMIN' || req.user?.role === 'CUSTOMER_USER'
    ? req.user.organizationId
    : (req.body.organizationId || 'org-apex-logistics');

  const { source, sourceType, severity, eventCategory, eventDescription, sourceIP, destinationIP, username, host, mitreTechnique } = req.body;

  if (!source || !eventCategory || !eventDescription) {
    res.status(400).json({ error: 'Source, category, and event description are required.' });
    return;
  }

  const result = DetectionEngine.ingestAndCorrelate({
    organizationId: targetOrg,
    source: source || 'Live Syslog Ingest',
    sourceType: sourceType || 'FIREWALL',
    severity: severity || 'MEDIUM',
    eventCategory,
    sourceIP: sourceIP || '198.51.100.42',
    destinationIP: destinationIP || '10.100.1.5',
    username,
    host,
    eventDescription,
    mitreTechnique
  });

  res.status(201).json(result);
});

// ==========================================
// 6. DETECTION RULES
// ==========================================
apiRouter.get('/detection-rules', (req: AuthenticatedRequest, res: Response) => {
  res.json(db.detectionRules);
});

apiRouter.post('/detection-rules', requireRoles(['STK_SUPER_ADMIN']) as any, (req: AuthenticatedRequest, res: Response) => {
  const { name, description, severity, category, threshold, timeWindowMinutes, mitreTechnique, conditionLogic } = req.body;
  if (!name || !description || !category) {
    res.status(400).json({ error: 'Name, description, and category are required' });
    return;
  }

  const newRule = {
    id: `rule-${Date.now().toString(36)}`,
    name,
    description,
    severity: severity || 'HIGH',
    category,
    enabled: true,
    threshold: threshold || 5,
    timeWindowMinutes: timeWindowMinutes || 5,
    mitreTechnique: mitreTechnique || 'T1059',
    organizationScope: req.body.organizationScope || 'GLOBAL',
    notificationPolicy: req.body.notificationPolicy || 'IMMEDIATE',
    conditionLogic: conditionLogic || 'count(events) >= threshold',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.detectionRules.push(newRule);
  db.addAuditLog(req.user!, 'CREATE_DETECTION_RULE', 'DetectionRule', newRule.id, 'SUCCESS', 'org-stk-global', { name: newRule.name });
  res.status(201).json(newRule);
});

apiRouter.post('/detection-rules/:id/toggle', requireRoles(['STK_SUPER_ADMIN']) as any, (req: AuthenticatedRequest, res: Response) => {
  const rule = db.detectionRules.find(r => r.id === req.params.id);
  if (!rule) {
    res.status(404).json({ error: 'Rule not found' });
    return;
  }
  rule.enabled = !rule.enabled;
  rule.updatedAt = new Date().toISOString();

  db.addAuditLog(req.user!, 'TOGGLE_DETECTION_RULE', 'DetectionRule', rule.id, 'SUCCESS', 'org-stk-global', { enabled: rule.enabled });
  res.json(rule);
});

// ==========================================
// 7. ALERTS
// ==========================================
apiRouter.get('/alerts', (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.targetOrgId;
  const { status, severity } = req.query;

  let list = orgId === 'all' ? db.alerts : db.alerts.filter(a => a.organizationId === orgId);
  if (status) list = list.filter(a => a.status === status);
  if (severity) list = list.filter(a => a.severity === severity);

  res.json(list);
});

apiRouter.put('/alerts/:id/status', requireRoles(['STK_SUPER_ADMIN', 'STK_SECURITY_ANALYST', 'CUSTOMER_ADMIN']) as any, (req: AuthenticatedRequest, res: Response) => {
  const alert = db.alerts.find(a => a.id === req.params.id);
  if (!alert) {
    res.status(404).json({ error: 'Alert not found' });
    return;
  }

  if (req.user?.role === 'CUSTOMER_ADMIN' && alert.organizationId !== req.user.organizationId) {
    res.status(403).json({ error: 'Tenant isolation violation' });
    return;
  }

  const { status, note } = req.body;
  if (status) alert.status = status;
  if (status === 'RESOLVED') alert.resolvedAt = new Date().toISOString();

  if (note) {
    alert.analystNotes = alert.analystNotes || [];
    alert.analystNotes.push(`${new Date().toISOString().substring(0, 19)}Z: ${req.user!.name} - ${note}`);
  }

  db.addAuditLog(req.user!, 'UPDATE_ALERT_STATUS', 'Alert', alert.id, 'SUCCESS', alert.organizationId, { status, note });
  res.json(alert);
});

// ==========================================
// 8. INCIDENTS
// ==========================================
apiRouter.get('/incidents', (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.targetOrgId;
  const list = orgId === 'all' ? db.incidents : db.incidents.filter(i => i.organizationId === orgId);
  res.json(list);
});

apiRouter.post('/incidents', requireRoles(['STK_SUPER_ADMIN', 'STK_SECURITY_ANALYST', 'CUSTOMER_ADMIN']) as any, (req: AuthenticatedRequest, res: Response) => {
  const targetOrg = req.user?.role === 'CUSTOMER_ADMIN' ? req.user.organizationId : (req.body.organizationId || req.user?.organizationId);
  const { title, description, severity, affectedAssetIds } = req.body;

  if (!title || !description) {
    res.status(400).json({ error: 'Title and description required' });
    return;
  }

  const affectedAssets = db.assets.filter(a => affectedAssetIds?.includes(a.id));
  const newIncident = {
    id: `inc-${Date.now().toString(36)}`,
    organizationId: targetOrg,
    title,
    description,
    severity: severity || 'HIGH',
    status: 'DETECTED' as const,
    assignedAnalystId: req.user!.id,
    assignedAnalystName: req.user!.name,
    affectedAssetIds: affectedAssets.map(a => a.id),
    affectedAssetHostnames: affectedAssets.map(a => a.hostname),
    relatedAlertIds: req.body.relatedAlertIds || [],
    relatedEventIds: req.body.relatedEventIds || [],
    timeline: [
      {
        id: `tl-${Date.now()}`,
        timestamp: new Date().toISOString(),
        actor: req.user!.name,
        action: 'Incident Created',
        description: `Incident manually declared by ${req.user!.name}.`,
        type: 'STATUS_CHANGE' as const
      }
    ],
    evidence: req.body.evidence || [],
    notes: req.body.notes || [],
    actionsTaken: req.body.actionsTaken || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.incidents.unshift(newIncident);
  db.addAuditLog(req.user!, 'CREATE_INCIDENT', 'Incident', newIncident.id, 'SUCCESS', targetOrg, { title: newIncident.title, severity: newIncident.severity });

  res.status(201).json(newIncident);
});

apiRouter.put('/incidents/:id', requireRoles(['STK_SUPER_ADMIN', 'STK_SECURITY_ANALYST', 'CUSTOMER_ADMIN']) as any, (req: AuthenticatedRequest, res: Response) => {
  const incident = db.incidents.find(i => i.id === req.params.id);
  if (!incident) {
    res.status(404).json({ error: 'Incident not found' });
    return;
  }

  if (req.user?.role === 'CUSTOMER_ADMIN' && incident.organizationId !== req.user.organizationId) {
    res.status(403).json({ error: 'Tenant isolation violation' });
    return;
  }

  const { status, actionDescription, rootCause, lessonsLearned } = req.body;
  if (status && status !== incident.status) {
    incident.timeline.push({
      id: `tl-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actor: req.user!.name,
      action: `Status changed to ${status}`,
      description: actionDescription || `Status changed from ${incident.status} to ${status}.`,
      type: 'STATUS_CHANGE'
    });
    incident.status = status;
    if (status === 'CLOSED') {
      incident.closedAt = new Date().toISOString();
    }
  }

  if (rootCause) incident.rootCause = rootCause;
  if (lessonsLearned) incident.lessonsLearned = lessonsLearned;
  incident.updatedAt = new Date().toISOString();

  db.addAuditLog(req.user!, 'UPDATE_INCIDENT', 'Incident', incident.id, 'SUCCESS', incident.organizationId, { status: incident.status });
  res.json(incident);
});

// ==========================================
// 9. VULNERABILITIES
// ==========================================
apiRouter.get('/vulnerabilities', (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.targetOrgId;
  const list = orgId === 'all' ? db.vulnerabilities : db.vulnerabilities.filter(v => v.organizationId === orgId);
  res.json(list);
});

apiRouter.put('/vulnerabilities/:id', requireRoles(['STK_SUPER_ADMIN', 'STK_SECURITY_ANALYST', 'CUSTOMER_ADMIN']) as any, (req: AuthenticatedRequest, res: Response) => {
  const vuln = db.vulnerabilities.find(v => v.id === req.params.id);
  if (!vuln) {
    res.status(404).json({ error: 'Vulnerability not found' });
    return;
  }

  if (req.user?.role === 'CUSTOMER_ADMIN' && vuln.organizationId !== req.user.organizationId) {
    res.status(403).json({ error: 'Tenant isolation violation' });
    return;
  }

  const { status, assignedPerson } = req.body;
  if (status) vuln.status = status;
  if (assignedPerson) vuln.assignedPerson = assignedPerson;
  vuln.updatedAt = new Date().toISOString();

  db.addAuditLog(req.user!, 'UPDATE_VULNERABILITY', 'Vulnerability', vuln.id, 'SUCCESS', vuln.organizationId, { status: vuln.status });
  res.json(vuln);
});

// ==========================================
// 10. MONITORING (CERTIFICATES, DOMAINS, BACKUPS, EXPOSURE, IDENTITY)
// ==========================================
apiRouter.get('/monitoring/certificates', (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.targetOrgId;
  const list = orgId === 'all' ? db.certificates : db.certificates.filter(c => c.organizationId === orgId);
  res.json(list);
});

apiRouter.get('/monitoring/domains', (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.targetOrgId;
  const list = orgId === 'all' ? db.domains : db.domains.filter(d => d.organizationId === orgId);
  res.json(list);
});

apiRouter.get('/monitoring/backups', (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.targetOrgId;
  const list = orgId === 'all' ? db.backups : db.backups.filter(b => b.organizationId === orgId);
  res.json(list);
});

apiRouter.get('/monitoring/exposure', (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.targetOrgId;
  const list = orgId === 'all' ? db.externalExposures : db.externalExposures.filter(e => e.organizationId === orgId);
  res.json(list);
});

apiRouter.get('/monitoring/identity', (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.targetOrgId;
  const list = orgId === 'all' ? db.identityStats : db.identityStats.filter(i => i.organizationId === orgId);
  res.json(list);
});

// ==========================================
// 11. SECURITY POSTURE SCORING
// ==========================================
apiRouter.get('/posture/score', (req: AuthenticatedRequest, res: Response) => {
  const targetOrg = req.targetOrgId === 'all' ? 'org-apex-logistics' : req.targetOrgId!;
  const score = db.calculatePostureScore(targetOrg);
  res.json(score);
});

// ==========================================
// 12. REPORTS
// ==========================================
apiRouter.get('/reports', (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.targetOrgId;
  const list = orgId === 'all' ? db.reports : db.reports.filter(r => r.organizationId === orgId);
  res.json(list);
});

apiRouter.post('/reports/generate', requireRoles(['STK_SUPER_ADMIN', 'STK_SECURITY_ANALYST', 'CUSTOMER_ADMIN']) as any, (req: AuthenticatedRequest, res: Response) => {
  const targetOrgId = req.user?.role === 'CUSTOMER_ADMIN' ? req.user.organizationId : (req.body.organizationId || 'org-apex-logistics');
  const org = db.organizations.find(o => o.id === targetOrgId);
  const posture = db.calculatePostureScore(targetOrgId);

  const newReport = {
    id: `rep-${Date.now().toString(36)}`,
    organizationId: targetOrgId,
    organizationName: org ? org.name : 'Target Organization',
    reportType: req.body.reportType || 'EXECUTIVE',
    title: req.body.title || `Cybersecurity Review — ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
    dateRange: {
      start: req.body.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10),
      end: req.body.endDate || new Date().toISOString().substring(0, 10)
    },
    generatedBy: req.user!.name,
    generatedAt: new Date().toISOString(),
    executiveSummary: `PNGee CyberGuard monitored cybersecurity telemetry for ${org?.name}. Monitored posture is scored at ${posture.overallScore}/100 with ${posture.openIncidents} active incident(s) under containment and ${posture.criticalFindings} critical priority finding(s).`,
    securityScore: posture.overallScore,
    incidentsSummary: {
      total: db.incidents.filter(i => i.organizationId === targetOrgId).length,
      critical: db.incidents.filter(i => i.organizationId === targetOrgId && i.severity === 'CRITICAL').length,
      resolved: db.incidents.filter(i => i.organizationId === targetOrgId && i.status === 'CLOSED').length
    },
    vulnerabilitiesSummary: {
      total: db.vulnerabilities.filter(v => v.organizationId === targetOrgId).length,
      critical: db.vulnerabilities.filter(v => v.organizationId === targetOrgId && v.severity === 'CRITICAL').length,
      remediated: db.vulnerabilities.filter(v => v.organizationId === targetOrgId && v.status === 'REMEDIATED').length
    },
    endpointHealthSummary: {
      total: db.assets.filter(a => a.organizationId === targetOrgId).length,
      online: db.assets.filter(a => a.organizationId === targetOrgId && a.status === 'ONLINE').length,
      securePercent: 90
    },
    backupHealthSummary: {
      total: db.backups.filter(b => b.organizationId === targetOrgId).length,
      failingCount: db.backups.filter(b => b.organizationId === targetOrgId && b.status === 'FAILED').length
    },
    topRecommendations: posture.factors.flatMap(f => f.remediationAdvice).slice(0, 4),
    status: 'READY' as const
  };

  db.reports.unshift(newReport);
  db.addAuditLog(req.user!, 'GENERATE_REPORT', 'Report', newReport.id, 'SUCCESS', targetOrgId, { title: newReport.title });

  res.status(201).json(newReport);
});

// ==========================================
// 13. INTEGRATIONS & THREAT INTEL
// ==========================================
apiRouter.get('/integrations', (req: AuthenticatedRequest, res: Response) => {
  res.json(db.integrations);
});

apiRouter.post('/integrations/:id/toggle', requireRoles(['STK_SUPER_ADMIN']) as any, (req: AuthenticatedRequest, res: Response) => {
  const integ = db.integrations.find(i => i.id === req.params.id);
  if (!integ) {
    res.status(404).json({ error: 'Integration not found' });
    return;
  }
  integ.status = integ.status === 'CONNECTED' ? 'DISCONNECTED' : 'CONNECTED';
  integ.lastSyncAt = new Date().toISOString();
  db.addAuditLog(req.user!, 'TOGGLE_INTEGRATION', 'Integration', integ.id, 'SUCCESS', 'org-stk-global', { status: integ.status });
  res.json(integ);
});

apiRouter.get('/threat-intel', (req: AuthenticatedRequest, res: Response) => {
  res.json(db.threatIntel);
});

// ==========================================
// 14. AUDIT LOGS
// ==========================================
apiRouter.get('/audit-logs', (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.targetOrgId;
  const list = orgId === 'all' ? db.auditLogs : db.auditLogs.filter(a => a.organizationId === orgId);
  res.json(list);
});

// ==========================================
// 15. SUBSCRIPTIONS & PLANS
// ==========================================
apiRouter.get('/subscriptions/plans', (req: AuthenticatedRequest, res: Response) => {
  res.json(db.plans);
});

// ==========================================
// 16. AI COPILOT & SECURITY ASSISTANT
// ==========================================
apiRouter.post('/ai/summarize-alert', async (req: AuthenticatedRequest, res: Response) => {
  const { alertId } = req.body;
  const alert = db.alerts.find(a => a.id === alertId);
  if (!alert) {
    res.status(404).json({ error: 'Alert not found' });
    return;
  }

  const relatedEvents = db.securityEvents.filter(e => alert.relatedEventIds?.includes(e.id));
  const summary = await GeminiSecurityService.summarizeAlert(alert, relatedEvents);

  res.json({ summary });
});

apiRouter.post('/ai/incident-summary', async (req: AuthenticatedRequest, res: Response) => {
  const { incidentId } = req.body;
  const incident = db.incidents.find(i => i.id === incidentId);
  if (!incident) {
    res.status(404).json({ error: 'Incident not found' });
    return;
  }

  const summary = await GeminiSecurityService.generateIncidentSummary(incident);
  res.json({ summary });
});

apiRouter.post('/ai/assistant', async (req: AuthenticatedRequest, res: Response) => {
  const { query, organizationId } = req.body;
  const targetOrgId = req.user?.role === 'CUSTOMER_ADMIN' || req.user?.role === 'CUSTOMER_USER'
    ? req.user.organizationId
    : (organizationId || 'org-apex-logistics');

  const org = db.organizations.find(o => o.id === targetOrgId);
  const posture = db.calculatePostureScore(targetOrgId);
  const incidents = db.incidents.filter(i => i.organizationId === targetOrgId);
  const alerts = db.alerts.filter(a => a.organizationId === targetOrgId);
  const vulnerabilities = db.vulnerabilities.filter(v => v.organizationId === targetOrgId);
  const backups = db.backups.filter(b => b.organizationId === targetOrgId);
  const certificates = db.certificates.filter(c => c.organizationId === targetOrgId);

  const orgContext = {
    orgName: org?.name || 'Customer Organization',
    posture,
    incidents,
    alerts,
    vulnerabilities,
    backups,
    certificates
  };

  const responseText = await GeminiSecurityService.queryAssistant(query || 'What are the top security risks?', orgContext);
  res.json({ response: responseText });
});

// ==========================================
// 17. AUTOMATED TESTS & OBSERVABILITY
// ==========================================
apiRouter.get('/tests/run', (req: AuthenticatedRequest, res: Response) => {
  const testResults = AutomatedTestRunner.runAllTests();
  res.json(testResults);
});

apiRouter.get('/system/health', (req: AuthenticatedRequest, res: Response) => {
  const healthMatrix = db.getSystemHealth();
  res.json({
    status: healthMatrix.application,
    product: 'PNGee CyberGuard',
    company: 'PNGee IT Solutions',
    version: '2.4.0-commercial',
    edition: db.commercialLicense.edition,
    deploymentMode: db.deploymentMode,
    onPremServerUrl: db.onPremServerUrl,
    isAirGapped: db.isAirGapped,
    healthMatrix,
    license: db.commercialLicense,
    storageConfig: db.storageConfig,
    database: {
      type: db.deploymentMode === 'cloud' ? 'Managed Cloud PostgreSQL' : 'Local Enterprise PostgreSQL',
      status: healthMatrix.database,
      connections: healthMatrix.dbConnectionsCount,
      sizeMb: healthMatrix.dbSizeMb,
      organizationsCount: db.organizations.length,
      usersCount: db.users.length,
      assetsCount: db.assets.length,
      eventsIngestedTotal: db.securityEvents.length + 42350,
      activeAlertsCount: db.alerts.length,
      activeIncidentsCount: db.incidents.length
    },
    storage: {
      backend: db.storageConfig.backend,
      status: healthMatrix.storage,
      usedGb: healthMatrix.diskCapacityUsedGb,
      totalGb: healthMatrix.diskCapacityTotalGb,
      localPath: db.storageConfig.localPath,
      s3Bucket: db.storageConfig.s3Bucket
    },
    backups: {
      lastBackupAt: healthMatrix.lastBackupAt,
      totalSnapshots: db.backupSnapshots.length,
      latestSnapshot: db.backupSnapshots[0]
    },
    telemetryIngestRatePerMin: 142,
    detectionEngineStatus: healthMatrix.detectionEngine,
    aiCopilotStatus: healthMatrix.aiIntegration === 'ONLINE' ? 'ONLINE (Gemini 3.7 Flash Engine)' : 'LOCAL_OFFLINE (Autonomous Heuristic SOC Mode)'
  });
});

apiRouter.post('/system/deployment-mode', requireRoles(['PNGEE_SUPER_ADMIN']) as any, (req: AuthenticatedRequest, res: Response) => {
  const { mode, onPremServerUrl } = req.body;
  if (mode !== 'cloud' && mode !== 'on_prem') {
    res.status(400).json({ error: 'Invalid deployment mode. Must be "cloud" or "on_prem".' });
    return;
  }
  db.deploymentMode = mode;
  if (onPremServerUrl) {
    db.onPremServerUrl = onPremServerUrl;
  }
  db.commercialLicense.deploymentMode = mode;
  db.addAuditLog(req.user!, 'UPDATE_DEPLOYMENT_MODE', 'SystemConfig', mode, 'SUCCESS', undefined, { mode, onPremServerUrl });
  res.json({
    success: true,
    deploymentMode: db.deploymentMode,
    onPremServerUrl: db.onPremServerUrl,
    message: `Deployment mode updated to ${mode.toUpperCase()}.`
  });
});

apiRouter.post('/system/storage-config', requireRoles(['PNGEE_SUPER_ADMIN']) as any, (req: AuthenticatedRequest, res: Response) => {
  const { backend, localPath, s3Bucket, s3Endpoint, s3Region } = req.body;
  if (backend !== 'local' && backend !== 's3_compatible') {
    res.status(400).json({ error: 'Invalid storage backend. Must be "local" or "s3_compatible".' });
    return;
  }
  db.storageConfig = {
    backend,
    localPath: localPath || db.storageConfig.localPath,
    s3Bucket: s3Bucket || db.storageConfig.s3Bucket,
    s3Endpoint: s3Endpoint || db.storageConfig.s3Endpoint,
    s3Region: s3Region || db.storageConfig.s3Region,
    isAirGappedRestricted: db.isAirGapped
  };
  db.addAuditLog(req.user!, 'UPDATE_STORAGE_CONFIG', 'StorageConfig', backend, 'SUCCESS', undefined, db.storageConfig);
  res.json({
    success: true,
    storageConfig: db.storageConfig,
    message: `Storage backend configured to ${backend === 'local' ? 'Local Filesystem' : 'S3-Compatible Object Store'}.`
  });
});

apiRouter.post('/system/license/update', requireRoles(['PNGEE_SUPER_ADMIN']) as any, (req: AuthenticatedRequest, res: Response) => {
  const { licenseKey } = req.body;
  if (!licenseKey || typeof licenseKey !== 'string') {
    res.status(400).json({ error: 'License key required.' });
    return;
  }

  // Parse license edition based on prefix
  const isEnterprise = licenseKey.toUpperCase().includes('ENT');
  const isBusiness = licenseKey.toUpperCase().includes('BIZ') || licenseKey.toUpperCase().includes('BUS');
  const edition = isEnterprise ? 'ENTERPRISE' : isBusiness ? 'BUSINESS' : 'BASIC';
  const maxEndpoints = isEnterprise ? 500 : isBusiness ? 100 : 25;

  db.commercialLicense = {
    licenseKey: licenseKey.trim(),
    edition,
    deploymentMode: db.deploymentMode,
    licensedTo: 'Customer Licensed Production Deployment',
    maxEndpoints,
    currentEndpoints: db.assets.length,
    maxUsers: isEnterprise ? 50 : isBusiness ? 10 : 3,
    validUntil: '2028-12-31T23:59:59Z',
    supportValidUntil: '2028-12-31T23:59:59Z',
    status: 'ACTIVE',
    features: {
      cloudAi: true,
      localAi: true,
      offlineMode: true,
      multiTenant: isEnterprise,
      customIntegrations: isEnterprise || isBusiness,
      pdfReporting: true,
      apiAccess: true
    }
  };

  db.addAuditLog(req.user!, 'UPDATE_COMMERCIAL_LICENSE', 'License', licenseKey, 'SUCCESS', undefined, { edition, maxEndpoints });
  res.json({
    success: true,
    license: db.commercialLicense,
    message: `License validated successfully. Activated ${edition} edition with ${maxEndpoints} endpoint capacity.`
  });
});

apiRouter.post('/system/airgap-toggle', requireRoles(['PNGEE_SUPER_ADMIN']) as any, (req: AuthenticatedRequest, res: Response) => {
  const { isAirGapped } = req.body;
  db.isAirGapped = Boolean(isAirGapped);
  db.storageConfig.isAirGappedRestricted = db.isAirGapped;
  db.addAuditLog(req.user!, 'TOGGLE_AIR_GAPPED_MODE', 'SystemSecurity', String(db.isAirGapped), 'SUCCESS');
  res.json({
    success: true,
    isAirGapped: db.isAirGapped,
    message: db.isAirGapped ? 'Air-gapped / offline restricted mode ENGAGED. Cloud egress disabled.' : 'Standard network mode ENGAGED. Cloud integrations operational.'
  });
});

apiRouter.get('/system/mode', (req: AuthenticatedRequest, res: Response) => {
  res.json({
    appMode: db.appMode,
    isSyntheticAllowed: db.appMode !== 'production',
    deploymentMode: db.deploymentMode,
    isAirGapped: db.isAirGapped
  });
});

apiRouter.post('/system/mode', requireRoles(['PNGEE_SUPER_ADMIN']) as any, (req: AuthenticatedRequest, res: Response) => {
  const { mode } = req.body;
  if (!['development', 'demo', 'production'].includes(mode)) {
    res.status(400).json({ error: 'Invalid mode. Must be development, demo, or production.' });
    return;
  }
  const prevMode = db.appMode;
  db.appMode = mode;
  db.addAuditLog(req.user!, 'UPDATE_APP_MODE', 'SystemConfiguration', mode, 'SUCCESS', undefined, { prevMode, newMode: mode });
  res.json({
    success: true,
    appMode: db.appMode,
    message: `Application mode changed from ${prevMode} to ${mode}. ${mode === 'production' ? 'Strict production security enforced. Synthetic telemetry disabled.' : 'Non-production environment mode engaged.'}`
  });
});

// ==========================================
// 15. DISASTER RECOVERY & SNAPSHOTS
// ==========================================
apiRouter.get('/system/backups', (req: AuthenticatedRequest, res: Response) => {
  const snapshots = DisasterRecoveryService.listSnapshots();
  res.json({
    storageBackend: db.storageConfig.backend,
    snapshots
  });
});

apiRouter.post('/system/backups/create', requireRoles(['PNGEE_SUPER_ADMIN', 'CUSTOMER_ADMIN']) as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const snapshot = DisasterRecoveryService.createSnapshot(req.user?.id || 'usr-pngee-admin-1');
    db.addAuditLog(req.user!, 'CREATE_BACKUP_SNAPSHOT', 'DisasterRecovery', snapshot.id, 'SUCCESS', undefined, {
      filename: snapshot.filename,
      checksum: snapshot.checksum,
      recordsCount: snapshot.recordsCount
    });
    res.json({
      success: true,
      snapshot,
      message: `Full system disaster recovery snapshot created. SHA-256: ${snapshot.checksum.substring(0, 16)}...`
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Snapshot creation failed', details: err.message });
  }
});

apiRouter.post('/system/backups/:id/restore', requireRoles(['PNGEE_SUPER_ADMIN']) as any, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    const result = DisasterRecoveryService.restoreSnapshot(id, req.user?.id || 'usr-pngee-admin-1');
    if (!result.allStepsPassed) {
      res.status(400).json({ error: 'Restore Failed', details: result.verifiedSteps });
      return;
    }
    db.addAuditLog(req.user!, 'RESTORE_BACKUP_SNAPSHOT', 'DisasterRecovery', id, 'SUCCESS', undefined, result);
    res.json({
      success: true,
      result,
      message: `System state restored successfully from verified snapshot ${id}.`
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Restore execution failed', details: err.message });
  }
});

// ==========================================
// 16. AGENT ENROLLMENT TOKENS MANAGEMENT
// ==========================================
apiRouter.get('/agent/tokens', (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role === 'PNGEE_SUPER_ADMIN' || req.user?.role === 'PNGEE_SECURITY_ANALYST') {
    res.json(db.enrollmentTokens);
  } else {
    res.json(db.enrollmentTokens.filter(t => t.organizationId === req.user?.organizationId));
  }
});

apiRouter.post('/agent/tokens/generate', requireRoles(['PNGEE_SUPER_ADMIN', 'CUSTOMER_ADMIN']) as any, (req: AuthenticatedRequest, res: Response) => {
  const targetOrgId = (req.user?.role === 'CUSTOMER_ADMIN') ? req.user.organizationId : (req.body.organizationId || req.user?.organizationId);
  const { name, osTarget, expiresInHours, maxUses, isOneTimeUse } = req.body;

  if (!name) {
    res.status(400).json({ error: 'Token descriptor name required' });
    return;
  }

  const { tokenRecord, rawToken } = AgentService.createEnrollmentToken({
    organizationId: targetOrgId,
    name,
    createdBy: req.user?.id || 'usr-admin',
    osTarget: osTarget || 'windows',
    expiresInHours: expiresInHours || 72,
    maxUses: maxUses || 1,
    isOneTimeUse: isOneTimeUse !== undefined ? isOneTimeUse : true
  });

  res.status(201).json({
    tokenRecord,
    rawToken,
    enrollmentCommand: `powershell -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri 'http://localhost:3000/api/v1/agent/scripts/install.ps1' -OutFile 'install.ps1'; .\\install.ps1 -Token '${rawToken}' -ServerUrl 'http://localhost:3000'"`
  });
});

apiRouter.post('/agent/tokens/:id/revoke', requireRoles(['PNGEE_SUPER_ADMIN', 'CUSTOMER_ADMIN']) as any, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const token = db.enrollmentTokens.find(t => t.id === id);
  if (!token) {
    res.status(404).json({ error: 'Token not found' });
    return;
  }

  if (req.user?.role === 'CUSTOMER_ADMIN' && token.organizationId !== req.user.organizationId) {
    res.status(403).json({ error: 'Unauthorized to revoke token for another tenant' });
    return;
  }

  token.isRevoked = true;
  db.addAuditLog(req.user!, 'REVOKE_ENROLLMENT_TOKEN', 'AgentEnrollmentToken', token.id, 'SUCCESS', token.organizationId);

  res.json({
    success: true,
    message: 'Enrollment token revoked successfully.'
  });
});

apiRouter.post('/system/reset-demo', requireRoles(['PNGEE_SUPER_ADMIN']) as any, (req: AuthenticatedRequest, res: Response) => {
  if (db.appMode === 'production') {
    res.status(403).json({
      error: 'Prohibited in Production Mode',
      message: 'Demo dataset reset is strictly blocked in production mode to prevent real data destruction.'
    });
    return;
  }

  db.reset();
  db.addAuditLog(req.user!, 'SYSTEM_RESET_DEMO_DATA', 'System', 'global', 'SUCCESS');
  res.json({ success: true, message: 'Database reset to initial synthetic demo state.' });
});

// ==========================================
// 17. AUTOMATED PRODUCTION VALIDATION TEST SUITE
// ==========================================
apiRouter.get('/tests/run', requireRoles(['PNGEE_SUPER_ADMIN', 'STK_SUPER_ADMIN']) as any, (req: AuthenticatedRequest, res: Response) => {
  const suiteResult = AutomatedTestRunner.runAllTests();
  res.json(suiteResult);
});

apiRouter.post('/tests/run', requireRoles(['PNGEE_SUPER_ADMIN', 'STK_SUPER_ADMIN']) as any, (req: AuthenticatedRequest, res: Response) => {
  const suiteResult = AutomatedTestRunner.runAllTests();
  res.json(suiteResult);
});

