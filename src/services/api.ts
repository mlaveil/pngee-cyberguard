import { Organization, User, Asset, SecurityEvent, DetectionRule, SecurityAlert, SecurityIncident, Vulnerability, SslCertificate, MonitoredDomain, BackupRecord, ExternalExposureRecord, IdentityAuthStat, AuditLog, ThreatIntelligenceIndicator, IntegrationConnector, SubscriptionPlanDetails, AgentEnrollmentToken, SecurityReport, SecurityPosture } from '../types';

let accessToken: string | null = sessionStorage.getItem('pngee_access_token');
let currentOrgIdFilter = 'all';

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (token) sessionStorage.setItem('pngee_access_token', token); else sessionStorage.removeItem('pngee_access_token');
}
export function setApiAuthContext(_userId?: string, orgIdFilter: string = 'all') { currentOrgIdFilter = orgIdFilter; }

async function refreshAccessToken(): Promise<string | null> {
  const response = await fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'include' });
  if (!response.ok) return null;
  const data = await response.json();
  setAccessToken(data.accessToken);
  return data.accessToken;
}

async function request<T>(endpoint: string, options: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  let url = endpoint.startsWith('/api') ? endpoint : `/api/v1${endpoint}`;
  if (currentOrgIdFilter && currentOrgIdFilter !== 'all' && !url.includes('orgId=')) url += `${url.includes('?') ? '&' : '?'}orgId=${encodeURIComponent(currentOrgIdFilter)}`;
  const response = await fetch(url, { ...options, headers, credentials: 'include' });
  if (response.status === 401 && retry && !endpoint.includes('/auth/')) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return request<T>(endpoint, options, false);
  }
  if (!response.ok) {
    let errorMsg = `Request failed: ${response.status} ${response.statusText}`;
    try { const errData = await response.json(); errorMsg = errData.message || errData.error || errorMsg; } catch {}
    throw new Error(errorMsg);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  login: async (email: string, password: string) => { const data = await request<{ user: User; accessToken: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }); setAccessToken(data.accessToken); return data; },
  logout: async () => { try { await request<void>('/auth/logout', { method: 'POST' }, false); } finally { setAccessToken(null); } },
  refresh: refreshAccessToken,
  getMe: () => request<{ user: User; organization: Organization | null; availableOrgs: Organization[] }>('/auth/me'),

  getOrganizations: () => request<Organization[]>('/organizations'),
  createOrganization: (data: Partial<Organization>) => request<Organization>('/organizations', { method: 'POST', body: JSON.stringify(data) }),
  updateOrganization: (id: string, data: Partial<Organization>) => request<Organization>(`/organizations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getUsers: () => request<User[]>('/users'),
  createUser: (data: Partial<User>) => request<User>('/users', { method: 'POST', body: JSON.stringify(data) }),
  getAssets: (params?: { type?: string; status?: string; criticality?: string }) => { const query = new URLSearchParams(params as any).toString(); return request<Asset[]>(`/assets${query ? `?${query}` : ''}`); },
  createAsset: (data: Partial<Asset>) => request<Asset>('/assets', { method: 'POST', body: JSON.stringify(data) }),
  getEnrollmentTokens: () => request<AgentEnrollmentToken[]>('/assets/enrollment-tokens'),
  createEnrollmentToken: (data: { name: string; osTarget: string; organizationId?: string }) => request<AgentEnrollmentToken>('/assets/enrollment-tokens', { method: 'POST', body: JSON.stringify(data) }),
  revokeEnrollmentToken: (id: string) => request<{ success: boolean; token: AgentEnrollmentToken }>(`/assets/enrollment-tokens/${id}/revoke`, { method: 'POST' }),
  getEvents: (params?: { category?: string; severity?: string; limit?: number }) => { const query = new URLSearchParams(params as any).toString(); return request<SecurityEvent[]>(`/events${query ? `?${query}` : ''}`); },
  ingestTelemetry: (payload: any) => request<{ event: SecurityEvent; generatedAlert?: SecurityAlert }>('/events/ingest', { method: 'POST', body: JSON.stringify(payload) }),
  getDetectionRules: () => request<DetectionRule[]>('/detection-rules'),
  createDetectionRule: (data: Partial<DetectionRule>) => request<DetectionRule>('/detection-rules', { method: 'POST', body: JSON.stringify(data) }),
  toggleDetectionRule: (id: string) => request<DetectionRule>(`/detection-rules/${id}/toggle`, { method: 'POST' }),
  getAlerts: (params?: { status?: string; severity?: string }) => { const query = new URLSearchParams(params as any).toString(); return request<SecurityAlert[]>(`/alerts${query ? `?${query}` : ''}`); },
  updateAlertStatus: (id: string, status: string, note?: string) => request<SecurityAlert>(`/alerts/${id}/status`, { method: 'PUT', body: JSON.stringify({ status, note }) }),
  getIncidents: () => request<SecurityIncident[]>('/incidents'),
  createIncident: (data: Partial<SecurityIncident>) => request<SecurityIncident>('/incidents', { method: 'POST', body: JSON.stringify(data) }),
  updateIncident: (id: string, data: any) => request<SecurityIncident>(`/incidents/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getVulnerabilities: () => request<Vulnerability[]>('/vulnerabilities'),
  updateVulnerability: (id: string, data: { status?: string; assignedPerson?: string }) => request<Vulnerability>(`/vulnerabilities/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getCertificates: () => request<SslCertificate[]>('/monitoring/certificates'),
  getDomains: () => request<MonitoredDomain[]>('/monitoring/domains'),
  getBackups: () => request<BackupRecord[]>('/monitoring/backups'),
  getExposure: () => request<ExternalExposureRecord[]>('/monitoring/exposure'),
  getIdentity: () => request<IdentityAuthStat[]>('/monitoring/identity'),
  getPostureScore: (orgId?: string) => request<SecurityPosture>(`/posture/score${orgId ? `?orgId=${orgId}` : ''}`),
  getReports: () => request<SecurityReport[]>('/reports'),
  generateReport: (data: { reportType: string; title?: string; organizationId?: string }) => request<SecurityReport>('/reports/generate', { method: 'POST', body: JSON.stringify(data) }),
  getIntegrations: () => request<IntegrationConnector[]>('/integrations'),
  toggleIntegration: (id: string) => request<IntegrationConnector>(`/integrations/${id}/toggle`, { method: 'POST' }),
  getThreatIntel: () => request<ThreatIntelligenceIndicator[]>('/threat-intel'),
  getAuditLogs: () => request<AuditLog[]>('/audit-logs'),
  getPlans: () => request<SubscriptionPlanDetails[]>('/subscriptions/plans'),
  summarizeAlert: (alertId: string) => request<{ summary: string }>('/ai/summarize-alert', { method: 'POST', body: JSON.stringify({ alertId }) }),
  generateIncidentSummary: (incidentId: string) => request<{ summary: string }>('/ai/incident-summary', { method: 'POST', body: JSON.stringify({ incidentId }) }),
  queryAssistant: (query: string, organizationId?: string) => request<{ response: string }>('/ai/assistant', { method: 'POST', body: JSON.stringify({ query, organizationId }) }),
  runTests: () => request<any>('/tests/run'), runAutomatedTests: () => request<any>('/tests/run'), getSystemHealth: () => request<any>('/system/health'),
  updateDeploymentMode: (mode: 'cloud' | 'on_prem', onPremServerUrl?: string) => request<any>('/system/deployment-mode', { method: 'POST', body: JSON.stringify({ mode, onPremServerUrl }) }),
  updateStorageConfig: (config: any) => request<any>('/system/storage-config', { method: 'POST', body: JSON.stringify(config) }),
  updateLicense: (licenseKey: string) => request<any>('/system/license/update', { method: 'POST', body: JSON.stringify({ licenseKey }) }),
  toggleAirGap: (isAirGapped: boolean) => request<any>('/system/airgap-toggle', { method: 'POST', body: JSON.stringify({ isAirGapped }) }),
  getSystemBackups: () => request<any>('/system/backups'), createSystemBackup: () => request<any>('/system/backups/create', { method: 'POST' }), restoreSystemBackup: (id: string) => request<any>(`/system/backups/${id}/restore`, { method: 'POST' }), resetDemoData: () => request<any>('/system/reset-demo', { method: 'POST' }),
  getAppMode: () => request<any>('/system/mode'), updateAppMode: (mode: 'development' | 'demo' | 'production') => request<any>('/system/mode', { method: 'POST', body: JSON.stringify({ mode }) }),
  generateEnrollmentToken: (data: any) => request<any>('/agent/tokens/generate', { method: 'POST', body: JSON.stringify(data) }),
  getNormalizedEvents: (limit = 50) => request<any>(`/agent/normalized-events?limit=${limit}`)
};
