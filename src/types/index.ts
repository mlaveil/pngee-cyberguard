export type UserRole = 
  | 'PNGEE_SUPER_ADMIN' 
  | 'PNGEE_SECURITY_ANALYST' 
  | 'CUSTOMER_ADMIN' 
  | 'CUSTOMER_USER'
  | 'STK_SUPER_ADMIN'
  | 'STK_SECURITY_ANALYST';

export type PlanType = 
  | 'PNGEE_BASIC' 
  | 'PNGEE_BUSINESS' 
  | 'PNGEE_ENTERPRISE'
  | 'STK_BASIC' 
  | 'STK_BUSINESS' 
  | 'STK_ENTERPRISE';

export type DeploymentMode = 'cloud' | 'on_prem';
export type StorageBackendType = 'local' | 's3_compatible';
export type AppMode = 'development' | 'demo' | 'production';

export interface SystemHealthStatus {
  application: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  database: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  storage: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  telemetry: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  detectionEngine: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  workers: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  notifications: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  aiIntegration: 'ONLINE' | 'LOCAL_OFFLINE' | 'DEGRADED';
  diskCapacityUsedGb: number;
  diskCapacityTotalGb: number;
  dbConnectionsCount: number;
  dbSizeMb: number;
  uptimeSeconds: number;
  appMode: AppMode;
  deploymentMode: DeploymentMode;
  storageBackend: StorageBackendType;
  isAirGapped: boolean;
  lastBackupAt: string;
}

export interface CommercialLicense {
  licenseKey: string;
  edition: 'BASIC' | 'BUSINESS' | 'ENTERPRISE';
  deploymentMode: DeploymentMode;
  licensedTo: string;
  maxEndpoints: number;
  currentEndpoints: number;
  maxUsers: number;
  validUntil: string;
  supportValidUntil: string;
  status: 'ACTIVE' | 'EXPIRED' | 'TRIAL';
  features: {
    cloudAi: boolean;
    localAi: boolean;
    offlineMode: boolean;
    multiTenant: boolean;
    customIntegrations: boolean;
    pdfReporting: boolean;
    apiAccess: boolean;
  };
}

export interface StorageConfig {
  backend: StorageBackendType;
  localPath: string;
  s3Bucket?: string;
  s3Endpoint?: string;
  s3Region?: string;
  isAirGappedRestricted: boolean;
}

export type Severity = 'INFORMATIONAL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type EventCategory = 
  | 'Authentication'
  | 'Malware'
  | 'Network'
  | 'Endpoint'
  | 'Vulnerability'
  | 'Identity'
  | 'Cloud'
  | 'Firewall'
  | 'DNS'
  | 'Application'
  | 'Data security'
  | 'Policy violation';

export type AssetType = 
  | 'Windows Endpoint'
  | 'Linux Endpoint'
  | 'macOS Endpoint'
  | 'Server'
  | 'Network Switch'
  | 'Router'
  | 'Firewall'
  | 'Wi-Fi Access Point'
  | 'Printer'
  | 'IoT Device'
  | 'Virtual Machine'
  | 'Cloud Resource'
  | 'Website'
  | 'Domain'
  | 'SSL Certificate'
  | 'Application';

export type AssetCriticality = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AssetStatus = 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'UNMANAGED' | 'MAINTENANCE';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  domain: string;
  contactEmail: string;
  contactPhone?: string;
  address?: string;
  plan: PlanType;
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING_ONBOARDING';
  maxAssets: number;
  assignedAnalysts: string[]; // User IDs
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  organizationId: string; // 'org-pngee-global' for PNGee staff
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  phone?: string;
  mfaEnabled: boolean;
  status: 'ACTIVE' | 'DISABLED' | 'INVITED';
  lastLoginAt?: string;
  lastLoginIp?: string;
  createdAt: string;
}

export interface Asset {
  id: string;
  organizationId: string;
  hostname: string;
  ipAddress: string;
  macAddress?: string;
  operatingSystem: string;
  osVersion: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  owner?: string;
  location?: string;
  assetType: AssetType;
  criticality: AssetCriticality;
  status: AssetStatus;
  lastSeen: string;
  agentStatus: 'ACTIVE' | 'INACTIVE' | 'NOT_INSTALLED' | 'OUTDATED';
  agentVersion?: string;
  securityStatus: 'SECURE' | 'AT_RISK' | 'COMPROMISED' | 'UNKNOWN';
  tags: string[];
  notes?: string;
  telemetry?: {
    cpuUsagePercent?: number;
    ramUsagePercent?: number;
    diskUsagePercent?: number;
    antivirusEnabled?: boolean;
    antivirusUpToDate?: boolean;
    firewallEnabled?: boolean;
    missingPatchesCount?: number;
    runningProcessesCount?: number;
    loggedInUsers?: string[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface AgentEnrollmentToken {
  id: string;
  organizationId: string;
  tokenKey: string; // Plaintext token returned once at creation time
  tokenKeyHash?: string; // SHA-256 hash stored on server for zero plaintext exposure
  name: string;
  osTarget: 'windows' | 'linux' | 'macos' | 'all';
  createdBy: string;
  expiresAt: string;
  isRevoked: boolean;
  usedCount: number;
  maxUses?: number;
  isOneTimeUse?: boolean;
  createdAt: string;
}

export interface EndpointIdentity {
  endpointId: string;
  agentId: string;
  organizationId: string;
  hostname: string;
  os: string;
  osVersion: string;
  agentVersion: string;
  firstSeen: string;
  lastSeen: string;
  status: AssetStatus;
  lastIp: string;
  lastHeartbeat: string;
  enrollmentTimestamp: string;
  agentSecretKeyHash: string; // SHA-256 hash
}

export interface NormalizedEndpointEvent {
  event_id: string;
  organization_id: string;
  asset_id: string;
  timestamp: string;
  source: 'endpoint_agent';
  source_vendor: 'PNGee';
  event_type: string;
  severity: Severity;
  hostname: string;
  username?: string;
  metadata: Record<string, any>;
  integrity_hash: string;
}

export interface SecurityEvent {
  id: string;
  organizationId: string;
  timestamp: string;
  source: string; // e.g. 'Fortinet FortiGate', 'Windows EventLog', 'CrowdStrike', 'Suricata'
  sourceType: 'FIREWALL' | 'ENDPOINT_AGENT' | 'SYSLOG' | 'DNS' | 'IDENTITY' | 'CLOUD' | 'BACKUP';
  severity: Severity;
  eventCategory: EventCategory;
  sourceIP?: string;
  destinationIP?: string;
  username?: string;
  host?: string;
  device?: string;
  eventDescription: string;
  rawEventReference?: string;
  detectionRuleId?: string;
  mitreTechnique?: string; // e.g. 'T1110 (Brute Force)'
  status: 'PROCESSED' | 'CORRELATED' | 'DISMISSED';
  analystNotes?: string;
  relatedIncidentId?: string;
  createdTimestamp: string;
}

export interface DetectionRule {
  id: string;
  name: string;
  description: string;
  severity: Severity;
  category: EventCategory;
  enabled: boolean;
  threshold: number; // e.g. 5 events
  timeWindowMinutes: number; // e.g. 5 minutes
  mitreTechnique: string;
  organizationScope: 'GLOBAL' | string; // 'GLOBAL' or specific org ID
  notificationPolicy: 'IMMEDIATE' | 'BATCHED' | 'SUPPRESSED';
  conditionLogic: string; // e.g. "Failed login count > threshold within window"
  createdAt: string;
  updatedAt: string;
}

export type AlertStatus = 'NEW' | 'ACKNOWLEDGED' | 'INVESTIGATING' | 'SUPPRESSED' | 'RESOLVED';

export interface SecurityAlert {
  id: string;
  organizationId: string;
  title: string;
  severity: Severity;
  status: AlertStatus;
  detectionRuleId?: string;
  detectionRuleName: string;
  assetId?: string;
  assetHostname?: string;
  username?: string;
  timestamp: string;
  evidence: string;
  relatedEventIds: string[];
  recommendedAction: string;
  assignedAnalystId?: string;
  assignedAnalystName?: string;
  linkedIncidentId?: string;
  occurrenceCount?: number;
  lastSeenTimestamp?: string;
  deduplicationKey?: string;
  analystNotes?: string[];
  createdAt: string;
  resolvedAt?: string;
}

export type IncidentStatus = 
  | 'DETECTED' 
  | 'TRIAGE' 
  | 'INVESTIGATING' 
  | 'CONTAINMENT' 
  | 'ERADICATION' 
  | 'RECOVERY' 
  | 'CLOSED';

export interface IncidentTimelineEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  description: string;
  type: 'SYSTEM' | 'ANALYST_ACTION' | 'STATUS_CHANGE' | 'TELEMETRY';
}

export interface SecurityIncident {
  id: string;
  organizationId: string;
  title: string;
  description: string;
  severity: Severity;
  status: IncidentStatus;
  assignedAnalystId?: string;
  assignedAnalystName?: string;
  affectedAssetIds: string[];
  affectedAssetHostnames: string[];
  relatedAlertIds: string[];
  relatedEventIds: string[];
  timeline: IncidentTimelineEntry[];
  evidence: string[];
  notes: string[];
  actionsTaken: string[];
  resolution?: string;
  rootCause?: string;
  lessonsLearned?: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
}

export type VulnerabilityStatus = 'OPEN' | 'IN_PROGRESS' | 'ACCEPTED_RISK' | 'REMEDIATED' | 'FALSE_POSITIVE';

export interface Vulnerability {
  id: string;
  organizationId: string;
  cveId: string; // e.g. 'CVE-2024-3400'
  title: string;
  description: string;
  cvssScore: number; // 0.0 - 10.0
  severity: Severity;
  affectedAssetId: string;
  affectedAssetHostname: string;
  software: string;
  installedVersion: string;
  fixedVersion: string;
  detectionDate: string;
  status: VulnerabilityStatus;
  dueDate: string;
  assignedPerson?: string;
  remediationGuidance: string;
  patchAvailable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SslCertificate {
  id: string;
  organizationId: string;
  domain: string;
  issuer: string;
  validFrom: string;
  validUntil: string;
  daysRemaining: number;
  status: 'VALID' | 'EXPIRING_SOON' | 'EXPIRED' | 'REVOKED' | 'INVALID_CHAIN';
  tlsVersion: string;
  chainStatus: 'VALID' | 'INCOMPLETE' | 'UNTRUSTED';
  keySize: string;
  lastChecked: string;
}

export interface MonitoredDomain {
  id: string;
  organizationId: string;
  domainName: string;
  registrar: string;
  expirationDate: string;
  daysToExpiry: number;
  dnsAvailability: boolean;
  nameservers: string[];
  mxRecords: string[];
  spfRecord: string;
  spfValid: boolean;
  dmarcRecord: string;
  dmarcValid: boolean;
  dkimConfigured: boolean;
  dnssecEnabled: boolean;
  lastChecked: string;
}

export interface BackupRecord {
  id: string;
  organizationId: string;
  backupSystem: string; // e.g. 'Veeam Backup & Replication', 'AWS Backup', 'Acronis'
  protectedAssetId: string;
  protectedAssetName: string;
  lastSuccessfulBackup: string;
  lastFailedBackup?: string;
  backupAgeHours: number;
  status: 'SUCCESS' | 'FAILED' | 'WARNING' | 'MISSED';
  recoveryPointStatus: 'RPO_MET' | 'RPO_BREACHED';
  backupSizeBytes: number;
  destination: string;
  lastChecked: string;
}

export interface ExternalExposureRecord {
  id: string;
  organizationId: string;
  target: string; // domain or IP
  publicIp: string;
  openPorts: number[];
  discoveredServices: string[];
  httpSecurityHeaders: {
    hsts: boolean;
    csp: boolean;
    xFrameOptions: boolean;
    xContentTypeOptions: boolean;
  };
  threatExposureGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  lastScanned: string;
}

export interface IdentityAuthStat {
  id: string;
  organizationId: string;
  timeRange: string;
  totalLoginAttempts: number;
  failedLogins: number;
  accountLockouts: number;
  mfaCoveragePercent: number;
  suspiciousGeographyCount: number;
  impossibleTravelEvents: number;
  privilegeEscalations: number;
  newAdminsCreated: number;
}

export interface PostureScoreFactor {
  category: string;
  weight: number;
  score: number; // 0 - 100
  status: 'OPTIMAL' | 'WARNING' | 'CRITICAL' | 'NOT_ASSESSED';
  assessed: boolean;
  positivePoints: string[];
  deductions: string[];
  remediationAdvice: string[];
}

export interface SecurityPosture {
  organizationId: string;
  overallScore: number; // 0 - 100
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  criticalFindings: number;
  highFindings: number;
  mediumFindings: number;
  lowFindings: number;
  openIncidents: number;
  unresolvedAlerts: number;
  vulnerableEndpoints: number;
  missingPatches: number;
  offlineEndpoints: number;
  backupFailures: number;
  expiringCertificates: number;
  expiringDomains: number;
  factors: PostureScoreFactor[];
  lastCalculated: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actor: string;
  actorEmail: string;
  organizationId: string;
  organizationName: string;
  action: string;
  resource: string;
  resourceId: string;
  sourceIP?: string;
  userAgent?: string;
  result: 'SUCCESS' | 'FAILURE' | 'DENIED';
  details?: Record<string, any>;
}

export interface NotificationRule {
  id: string;
  organizationId: string;
  name: string;
  enabled: boolean;
  channels: ('EMAIL' | 'IN_APP' | 'WEBHOOK' | 'SMS')[];
  minSeverity: Severity;
  eventCategories: EventCategory[];
  recipients: string[];
  webhookUrl?: string;
  businessHoursOnly: boolean;
}

export interface SecurityReport {
  id: string;
  organizationId: string;
  organizationName: string;
  reportType: 'EXECUTIVE' | 'TECHNICAL' | 'COMPLIANCE';
  title: string;
  dateRange: { start: string; end: string };
  generatedBy: string;
  generatedAt: string;
  executiveSummary: string;
  securityScore: number;
  incidentsSummary: { total: number; critical: number; resolved: number };
  vulnerabilitiesSummary: { total: number; critical: number; remediated: number };
  endpointHealthSummary: { total: number; online: number; securePercent: number };
  backupHealthSummary: { total: number; failingCount: number };
  topRecommendations: string[];
  status: 'READY' | 'GENERATING';
}

export interface ThreatIntelligenceIndicator {
  id: string;
  indicator: string;
  type: 'IP' | 'DOMAIN' | 'FILE_HASH_SHA256' | 'URL';
  source: string;
  confidence: number; // 0 - 100
  reputation: 'MALICIOUS' | 'SUSPICIOUS' | 'UNKNOWN';
  threatGroup?: string;
  malwareFamily?: string;
  firstSeen: string;
  lastSeen: string;
  expiresAt: string;
}

export interface IntegrationConnector {
  id: string;
  name: string;
  vendor: 'Fortinet' | 'Sophos' | 'pfSense' | 'Cisco' | 'Ubiquiti' | 'Microsoft 365' | 'Google Workspace' | 'AWS CloudTrail' | 'CrowdStrike';
  category: 'FIREWALL' | 'IDENTITY' | 'ENDPOINT_EDR' | 'CLOUD' | 'SIEM_SYSLOG';
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'AVAILABLE';
  organizationId?: string;
  lastSyncAt?: string;
  eventsIngested24h: number;
  config?: Record<string, any>;
}

export interface SubscriptionPlanDetails {
  planId: PlanType;
  name: string;
  description: string;
  priceMonthlyUSD: number;
  maxAssets: number;
  features: {
    endpointMonitoring: boolean;
    vulnerabilityManagement: boolean;
    incidentResponse: boolean;
    sslDomainMonitoring: boolean;
    backupMonitoring: boolean;
    externalExposure: boolean;
    aiSecurityCopilot: boolean;
    dedicatedAnalyst: boolean;
    slaHours: number;
    customIntegrations: boolean;
  };
}

export type SecurityIncidentStatus = IncidentStatus;
export type ThreatIntelIndicator = ThreatIntelligenceIndicator;

export interface TestSuiteResult {
  passed: number;
  failed: number;
  total: number;
  durationMs: number;
  timestamp: string;
  results: {
    name: string;
    category: string;
    passed: boolean;
    error?: string;
    durationMs: number;
  }[];
}

