import {
  Organization,
  User,
  Asset,
  SecurityEvent,
  DetectionRule,
  SecurityAlert,
  SecurityIncident,
  Vulnerability,
  SslCertificate,
  MonitoredDomain,
  BackupRecord,
  ExternalExposureRecord,
  IdentityAuthStat,
  AuditLog,
  ThreatIntelligenceIndicator,
  IntegrationConnector,
  SubscriptionPlanDetails,
  AgentEnrollmentToken,
  SecurityReport,
  SecurityPosture
} from '../types';

let currentUserId: string = 'usr-pngee-admin-1';
let currentOrgIdFilter: string = 'all';

export function setApiAuthContext(userId: string, orgIdFilter: string = 'all') {
  currentUserId = userId;
  currentOrgIdFilter = orgIdFilter;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  headers.set('x-user-id', currentUserId);

  let url = endpoint.startsWith('/api') ? endpoint : `/api/v1${endpoint}`;
  
  if (currentOrgIdFilter && currentOrgIdFilter !== 'all' && !url.includes('orgId=')) {
    const separator = url.includes('?') ? '&' : '?';
    url = `${url}${separator}orgId=${encodeURIComponent(currentOrgIdFilter)}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMsg = `Request failed: ${response.status} ${response.statusText}`;
    try {
      const errData = await response.json();
      errorMsg = errData.message || errData.error || errorMsg;
    } catch {
      // fallback
    }
    throw new Error(errorMsg);
  }

  return response.json() as Promise<T>;
}

export const api = {
  // Auth
  getMe: () => request<{ user: User; organization: Organization; availableOrgs: Organization[] }>('/auth/me'),
  switchUser: (userId: string) => request<{ success: boolean; user: User; organization: Organization }>('/auth/switch-user', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  }),

  // Organizations
  getOrganizations: () => request<Organization[]>('/organizations'),
  createOrganization: (data: Partial<Organization>) => request<Organization>('/organizations', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateOrganization: (id: string, data: Partial<Organization>) => request<Organization>(`/organizations/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  // Users
  getUsers: () => request<User[]>('/users'),
  createUser: (data: Partial<User>) => request<User>('/users', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // Assets
  getAssets: (params?: { type?: string; status?: string; criticality?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return request<Asset[]>(`/assets${query ? `?${query}` : ''}`);
  },
  createAsset: (data: Partial<Asset>) => request<Asset>('/assets', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  getEnrollmentTokens: () => request<AgentEnrollmentToken[]>('/assets/enrollment-tokens'),
  createEnrollmentToken: (data: { name: string; osTarget: string; organizationId?: string }) => request<AgentEnrollmentToken>('/assets/enrollment-tokens', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  revokeEnrollmentToken: (id: string) => request<{ success: boolean; token: AgentEnrollmentToken }>(`/assets/enrollment-tokens/${id}/revoke`, {
    method: 'POST',
  }),

  // Security Events & Telemetry
  getEvents: (params?: { category?: string; severity?: string; limit?: number }) => {
    const query = new URLSearchParams(params as any).toString();
    return request<SecurityEvent[]>(`/events${query ? `?${query}` : ''}`);
  },
  ingestTelemetry: (payload: any) => request<{ event: SecurityEvent; generatedAlert?: SecurityAlert }>('/events/ingest', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  // Detection Rules
  getDetectionRules: () => request<DetectionRule[]>('/detection-rules'),
  createDetectionRule: (data: Partial<DetectionRule>) => request<DetectionRule>('/detection-rules', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  toggleDetectionRule: (id: string) => request<DetectionRule>(`/detection-rules/${id}/toggle`, {
    method: 'POST',
  }),

  // Alerts
  getAlerts: (params?: { status?: string; severity?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return request<SecurityAlert[]>(`/alerts${query ? `?${query}` : ''}`);
  },
  updateAlertStatus: (id: string, status: string, note?: string) => request<SecurityAlert>(`/alerts/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status, note }),
  }),

  // Incidents
  getIncidents: () => request<SecurityIncident[]>('/incidents'),
  createIncident: (data: Partial<SecurityIncident>) => request<SecurityIncident>('/incidents', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateIncident: (id: string, data: any) => request<SecurityIncident>(`/incidents/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  // Vulnerabilities
  getVulnerabilities: () => request<Vulnerability[]>('/vulnerabilities'),
  updateVulnerability: (id: string, data: { status?: string; assignedPerson?: string }) => request<Vulnerability>(`/vulnerabilities/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  // Monitoring Modules
  getCertificates: () => request<SslCertificate[]>('/monitoring/certificates'),
  getDomains: () => request<MonitoredDomain[]>('/monitoring/domains'),
  getBackups: () => request<BackupRecord[]>('/monitoring/backups'),
  getExposure: () => request<ExternalExposureRecord[]>('/monitoring/exposure'),
  getIdentity: () => request<IdentityAuthStat[]>('/monitoring/identity'),

  // Posture Score
  getPostureScore: (orgId?: string) => request<SecurityPosture>(`/posture/score${orgId ? `?orgId=${orgId}` : ''}`),

  // Reports
  getReports: () => request<SecurityReport[]>('/reports'),
  generateReport: (data: { reportType: string; title?: string; organizationId?: string }) => request<SecurityReport>('/reports/generate', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // Integrations & Threat Intel
  getIntegrations: () => request<IntegrationConnector[]>('/integrations'),
  toggleIntegration: (id: string) => request<IntegrationConnector>(`/integrations/${id}/toggle`, {
    method: 'POST',
  }),
  getThreatIntel: () => request<ThreatIntelligenceIndicator[]>('/threat-intel'),

  // Audit Logs
  getAuditLogs: () => request<AuditLog[]>('/audit-logs'),

  // Plans
  getPlans: () => request<SubscriptionPlanDetails[]>('/subscriptions/plans'),

  // AI SOC Assistant
  summarizeAlert: (alertId: string) => request<{ summary: string }>('/ai/summarize-alert', {
    method: 'POST',
    body: JSON.stringify({ alertId }),
  }),
  generateIncidentSummary: (incidentId: string) => request<{ summary: string }>('/ai/incident-summary', {
    method: 'POST',
    body: JSON.stringify({ incidentId }),
  }),
  queryAssistant: (query: string, organizationId?: string) => request<{ response: string }>('/ai/assistant', {
    method: 'POST',
    body: JSON.stringify({ query, organizationId }),
  }),

  // Automated Tests & System Health
  runTests: () => request<any>('/tests/run'),
  runAutomatedTests: () => request<any>('/tests/run'),
  getSystemHealth: () => request<any>('/system/health'),
  updateDeploymentMode: (mode: 'cloud' | 'on_prem', onPremServerUrl?: string) => request<any>('/system/deployment-mode', {
    method: 'POST',
    body: JSON.stringify({ mode, onPremServerUrl }),
  }),
  updateStorageConfig: (config: any) => request<any>('/system/storage-config', {
    method: 'POST',
    body: JSON.stringify(config),
  }),
  updateLicense: (licenseKey: string) => request<any>('/system/license/update', {
    method: 'POST',
    body: JSON.stringify({ licenseKey }),
  }),
  toggleAirGap: (isAirGapped: boolean) => request<any>('/system/airgap-toggle', {
    method: 'POST',
    body: JSON.stringify({ isAirGapped }),
  }),
  getSystemBackups: () => request<any>('/system/backups'),
  createSystemBackup: () => request<any>('/system/backups/create', {
    method: 'POST',
  }),
  restoreSystemBackup: (id: string) => request<any>(`/system/backups/${id}/restore`, {
    method: 'POST',
  }),
  resetDemoData: () => request<{ success: boolean; message: string }>('/system/reset-demo', {
    method: 'POST',
  }),

  // Application Mode & Production Isolation
  getAppMode: () => request<{ appMode: 'development' | 'demo' | 'production'; isSyntheticAllowed: boolean; deploymentMode: string; isAirGapped: boolean }>('/system/mode'),
  updateAppMode: (mode: 'development' | 'demo' | 'production') => request<any>('/system/mode', {
    method: 'POST',
    body: JSON.stringify({ mode }),
  }),

  // Windows Endpoint Agent & Normalized Telemetry Ledger
  generateEnrollmentToken: (data: { organizationId?: string; name: string; osTarget?: string; expiresInHours?: number; maxUses?: number; isOneTimeUse?: boolean }) =>
    request<{ tokenRecord: AgentEnrollmentToken; rawToken: string; enrollmentCommand: string }>('/agent/tokens/generate', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getNormalizedEvents: (limit: number = 50) => request<{ totalCount: number; events: any[]; lastIntegrityHash: string }>(`/agent/normalized-events?limit=${limit}`)
};
