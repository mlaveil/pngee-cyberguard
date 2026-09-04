import fs from 'fs';
import path from 'path';
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
  NotificationRule,
  ThreatIntelligenceIndicator,
  IntegrationConnector,
  SubscriptionPlanDetails,
  AgentEnrollmentToken,
  SecurityReport,
  SecurityPosture,
  PostureScoreFactor,
  DeploymentMode,
  StorageBackendType,
  SystemHealthStatus,
  CommercialLicense,
  StorageConfig,
  AppMode,
  EndpointIdentity,
  NormalizedEndpointEvent
} from '../../src/types';

import {
  INITIAL_ORGANIZATIONS,
  INITIAL_USERS,
  INITIAL_PLANS,
  INITIAL_DETECTION_RULES,
  INITIAL_ASSETS,
  INITIAL_SECURITY_EVENTS,
  INITIAL_ALERTS,
  INITIAL_INCIDENTS,
  INITIAL_VULNERABILITIES,
  INITIAL_CERTIFICATES,
  INITIAL_DOMAINS,
  INITIAL_BACKUPS,
  INITIAL_EXTERNAL_EXPOSURE,
  INITIAL_IDENTITY_STATS,
  INITIAL_THREAT_INTEL,
  INITIAL_INTEGRATIONS,
  INITIAL_AUDIT_LOGS,
  INITIAL_NOTIFICATION_RULES,
  INITIAL_ENROLLMENT_TOKENS,
  INITIAL_REPORTS
} from './seed';

class DatabaseStore {
  public organizations: Organization[] = [];
  public users: User[] = [];
  public plans: SubscriptionPlanDetails[] = [];
  public detectionRules: DetectionRule[] = [];
  public assets: Asset[] = [];
  public securityEvents: SecurityEvent[] = [];
  public alerts: SecurityAlert[] = [];
  public incidents: SecurityIncident[] = [];
  public vulnerabilities: Vulnerability[] = [];
  public certificates: SslCertificate[] = [];
  public domains: MonitoredDomain[] = [];
  public backups: BackupRecord[] = [];
  public externalExposures: ExternalExposureRecord[] = [];
  public identityStats: IdentityAuthStat[] = [];
  public threatIntel: ThreatIntelligenceIndicator[] = [];
  public integrations: IntegrationConnector[] = [];
  public auditLogs: AuditLog[] = [];
  public notificationRules: NotificationRule[] = [];
  public enrollmentTokens: AgentEnrollmentToken[] = [];
  public reports: SecurityReport[] = [];
  public endpointIdentities: EndpointIdentity[] = [];
  public normalizedEvents: NormalizedEndpointEvent[] = [];
  public lastIntegrityHash: string = '0000000000000000000000000000000000000000000000000000000000000000';

  // Commercial Productization & Deployment Configuration
  public appMode: AppMode = (process.env.APP_MODE as AppMode) || 'development';
  public deploymentMode: DeploymentMode = 'cloud';
  public onPremServerUrl: string = 'https://cyberguard.internal.local';
  public isAirGapped: boolean = false;
  public storageConfig: StorageConfig = {
    backend: 'local',
    localPath: process.env.STORAGE_LOCAL_PATH || '/tmp/pngee_storage',
    isAirGappedRestricted: false
  };
  public commercialLicense: CommercialLicense = {
    licenseKey: 'PNGEE-ENT-2026-X889-KL44-PROD',
    edition: 'ENTERPRISE',
    deploymentMode: 'cloud',
    licensedTo: 'Commercial Multi-Tenant & On-Premises Suite',
    maxEndpoints: 500,
    currentEndpoints: 56,
    maxUsers: 50,
    validUntil: '2027-09-30T23:59:59Z',
    supportValidUntil: '2027-09-30T23:59:59Z',
    status: 'ACTIVE',
    features: {
      cloudAi: true,
      localAi: true,
      offlineMode: true,
      multiTenant: true,
      customIntegrations: true,
      pdfReporting: true,
      apiAccess: true
    }
  };
  public backupSnapshots: Array<{
    id: string;
    timestamp: string;
    sizeMb: number;
    checksum: string;
    filename: string;
    type: 'FULL' | 'INCREMENTAL';
    status: 'SUCCESS' | 'FAILED';
    location: string;
  }> = [
    {
      id: 'snap-20260901',
      timestamp: '2026-09-01T04:00:00Z',
      sizeMb: 142.5,
      checksum: 'sha256:7e8a93bf8110b2c892',
      filename: 'pngee_cyberguard_backup_20260901_full.tar.gz',
      type: 'FULL',
      status: 'SUCCESS',
      location: 'Local Storage (/var/lib/pngee/storage/backups)'
    }
  ];

  constructor() {
    this.reset();
  }

  public reset() {
    this.organizations = JSON.parse(JSON.stringify(INITIAL_ORGANIZATIONS));
    this.users = JSON.parse(JSON.stringify(INITIAL_USERS));
    this.plans = JSON.parse(JSON.stringify(INITIAL_PLANS));
    this.detectionRules = JSON.parse(JSON.stringify(INITIAL_DETECTION_RULES));
    this.assets = JSON.parse(JSON.stringify(INITIAL_ASSETS));
    this.securityEvents = JSON.parse(JSON.stringify(INITIAL_SECURITY_EVENTS));
    this.alerts = JSON.parse(JSON.stringify(INITIAL_ALERTS));
    this.incidents = JSON.parse(JSON.stringify(INITIAL_INCIDENTS));
    this.vulnerabilities = JSON.parse(JSON.stringify(INITIAL_VULNERABILITIES));
    this.certificates = JSON.parse(JSON.stringify(INITIAL_CERTIFICATES));
    this.domains = JSON.parse(JSON.stringify(INITIAL_DOMAINS));
    this.backups = JSON.parse(JSON.stringify(INITIAL_BACKUPS));
    this.externalExposures = JSON.parse(JSON.stringify(INITIAL_EXTERNAL_EXPOSURE));
    this.identityStats = JSON.parse(JSON.stringify(INITIAL_IDENTITY_STATS));
    this.threatIntel = JSON.parse(JSON.stringify(INITIAL_THREAT_INTEL));
    this.integrations = JSON.parse(JSON.stringify(INITIAL_INTEGRATIONS));
    this.auditLogs = JSON.parse(JSON.stringify(INITIAL_AUDIT_LOGS));
    this.notificationRules = JSON.parse(JSON.stringify(INITIAL_NOTIFICATION_RULES));
    this.enrollmentTokens = JSON.parse(JSON.stringify(INITIAL_ENROLLMENT_TOKENS));
    this.reports = JSON.parse(JSON.stringify(INITIAL_REPORTS));
    this.deploymentMode = 'cloud';
    this.isAirGapped = false;
  }

  public getSystemHealth(): SystemHealthStatus {
    const totalAssetsCount = this.assets.length;
    this.commercialLicense.currentEndpoints = totalAssetsCount;

    // 1. Storage Subsystem Validation
    let storageStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';
    try {
      const storageDir = this.storageConfig.localPath;
      if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
      }
      // Test writability
      const testFile = path.join(storageDir, '.health_probe');
      fs.writeFileSync(testFile, 'health-check');
      fs.unlinkSync(testFile);
    } catch {
      storageStatus = 'WARNING';
    }

    // 2. Database Subsystem Validation
    const dbStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 
      (this.organizations.length > 0 && this.users.length > 0) ? 'HEALTHY' : 'CRITICAL';

    // 3. Detection Engine Subsystem Validation
    const activeRulesCount = this.detectionRules.filter(r => r.enabled).length;
    const detectionStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL' = activeRulesCount >= 5 ? 'HEALTHY' : 'WARNING';

    // 4. Telemetry Pipeline Status
    const telemetryStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';

    // 5. Notifications Status (Air-gapped mode suspends external relays)
    const notifStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL' = this.isAirGapped ? 'WARNING' : 'HEALTHY';

    // 6. AI Subsystem Status
    const aiStatus: 'ONLINE' | 'LOCAL_OFFLINE' | 'DEGRADED' = 
      this.isAirGapped ? 'LOCAL_OFFLINE' : (process.env.GEMINI_API_KEY ? 'ONLINE' : 'LOCAL_OFFLINE');

    return {
      application: (dbStatus === 'HEALTHY' && storageStatus === 'HEALTHY') ? 'HEALTHY' : 'WARNING',
      database: dbStatus,
      storage: storageStatus,
      telemetry: telemetryStatus,
      detectionEngine: detectionStatus,
      workers: 'HEALTHY',
      notifications: notifStatus,
      aiIntegration: aiStatus,
      diskCapacityUsedGb: 41.2,
      diskCapacityTotalGb: 500,
      dbConnectionsCount: 16,
      dbSizeMb: 94.5,
      uptimeSeconds: Math.floor(process.uptime ? process.uptime() : 1249820),
      appMode: this.appMode,
      deploymentMode: this.deploymentMode,
      storageBackend: this.storageConfig.backend,
      isAirGapped: this.isAirGapped,
      lastBackupAt: this.backupSnapshots[0]?.timestamp || new Date().toISOString()
    };
  }

  public createBackupSnapshot() {
    const id = `snap-${Date.now()}`;
    const timestamp = new Date().toISOString();
    const snapshot = {
      id,
      timestamp,
      sizeMb: parseFloat((120 + Math.random() * 40).toFixed(1)),
      checksum: `sha256:${Math.random().toString(16).substring(2, 10)}${Math.random().toString(16).substring(2, 10)}`,
      filename: `pngee_cyberguard_backup_${new Date().toISOString().slice(0,10).replace(/-/g,'')}_${id.slice(-6)}.tar.gz`,
      type: 'FULL' as const,
      status: 'SUCCESS' as const,
      location: this.storageConfig.backend === 'local' ? `Local Storage (${this.storageConfig.localPath}/backups)` : `S3 Storage (${this.storageConfig.s3Bucket || 'pngee-backups'})`
    };
    this.backupSnapshots.unshift(snapshot);
    return snapshot;
  }

  public addAuditLog(
    actorUser: User,
    action: string,
    resource: string,
    resourceId: string,
    result: 'SUCCESS' | 'FAILURE' | 'DENIED',
    targetOrgId?: string,
    details?: Record<string, any>,
    ip: string = '127.0.0.1'
  ): AuditLog {
    const org = this.organizations.find(o => o.id === (targetOrgId || actorUser.organizationId));
    const log: AuditLog = {
      id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      actor: actorUser.name,
      actorEmail: actorUser.email,
      organizationId: targetOrgId || actorUser.organizationId,
      organizationName: org ? org.name : 'Unknown Organization',
      action,
      resource,
      resourceId,
      sourceIP: ip,
      result,
      details
    };
    this.auditLogs.unshift(log);
    return log;
  }

  public calculatePostureScore(orgId: string): SecurityPosture {
    const org = this.organizations.find(o => o.id === orgId);
    const orgAssets = this.assets.filter(a => a.organizationId === orgId);
    const orgVulns = this.vulnerabilities.filter(v => v.organizationId === orgId);
    const orgAlerts = this.alerts.filter(a => a.organizationId === orgId);
    const orgIncidents = this.incidents.filter(i => i.organizationId === orgId);
    const orgBackups = this.backups.filter(b => b.organizationId === orgId);
    const orgCerts = this.certificates.filter(c => c.organizationId === orgId);
    const orgDomains = this.domains.filter(d => d.organizationId === orgId);
    const orgIdentity = this.identityStats.find(i => i.organizationId === orgId);

    const openIncidents = orgIncidents.filter(i => i.status !== 'CLOSED').length;
    const unresolvedAlerts = orgAlerts.filter(a => a.status !== 'RESOLVED' && a.status !== 'SUPPRESSED').length;
    const criticalVulns = orgVulns.filter(v => v.status === 'OPEN' || v.status === 'IN_PROGRESS');
    const offlineAssets = orgAssets.filter(a => a.status === 'OFFLINE' || a.status === 'DEGRADED').length;
    const missingPatches = orgAssets.reduce((acc, a) => acc + (a.telemetry?.missingPatchesCount || 0), 0);
    const backupFailures = orgBackups.filter(b => b.status === 'FAILED' || b.recoveryPointStatus === 'RPO_BREACHED').length;
    const expiringCerts = orgCerts.filter(c => c.daysRemaining <= 14).length;
    const expiringDomains = orgDomains.filter(d => d.daysToExpiry <= 30).length;

    // 1. Endpoint & Patch Compliance (Weight: 25%)
    let endpointScore = 100;
    const endpointPositives: string[] = [];
    const endpointDeductions: string[] = [];
    const endpointAdvice: string[] = [];

    const protectedCount = orgAssets.filter(a => a.agentStatus === 'ACTIVE' && a.telemetry?.antivirusEnabled).length;
    const totalCount = orgAssets.length || 1;
    const coveragePct = Math.round((protectedCount / totalCount) * 100);

    if (coveragePct >= 85) {
      endpointPositives.push(`High EDR/Agent telemetry coverage (${coveragePct}% enrolled)`);
    } else {
      const penalty = Math.round((85 - coveragePct) * 0.6);
      endpointScore -= penalty;
      endpointDeductions.push(`Incomplete agent coverage (${coveragePct}% protected) [-${penalty} pts]`);
      endpointAdvice.push('Deploy PNGee CyberGuard agent to unmanaged endpoints using GPO or enrollment token.');
    }

    if (missingPatches > 0) {
      const penalty = Math.min(25, missingPatches * 5);
      endpointScore -= penalty;
      endpointDeductions.push(`${missingPatches} unapplied operating system security patches [-${penalty} pts]`);
      endpointAdvice.push('Schedule automated patch cycle for workstations and servers.');
    } else {
      endpointPositives.push('Zero unpatched critical operating system updates detected');
    }
    endpointScore = Math.max(0, Math.min(100, endpointScore));

    // 2. Vulnerability Management (Weight: 20%)
    let vulnScore = 100;
    const vulnPositives: string[] = [];
    const vulnDeductions: string[] = [];
    const vulnAdvice: string[] = [];

    const openCritVulns = criticalVulns.filter(v => v.severity === 'CRITICAL').length;
    const openHighVulns = criticalVulns.filter(v => v.severity === 'HIGH').length;

    if (openCritVulns > 0) {
      const penalty = Math.min(50, openCritVulns * 25);
      vulnScore -= penalty;
      vulnDeductions.push(`${openCritVulns} unpatched Critical CVEs (CVSS > 9.0) [-${penalty} pts]`);
      vulnAdvice.push('Apply vendor firmware / software updates immediately for open Critical CVEs.');
    }
    if (openHighVulns > 0) {
      const penalty = Math.min(30, openHighVulns * 10);
      vulnScore -= penalty;
      vulnDeductions.push(`${openHighVulns} High-severity vulnerabilities [-${penalty} pts]`);
    }
    if (openCritVulns === 0 && openHighVulns === 0) {
      vulnPositives.push('No unmitigated Critical or High CVSS vulnerabilities found');
    }
    vulnScore = Math.max(0, Math.min(100, vulnScore));

    // 3. Identity & Access Security (Weight: 15%)
    const idAssessed = !!orgIdentity;
    let idScore = 0;
    const idPositives: string[] = [];
    const idDeductions: string[] = [];
    const idAdvice: string[] = [];
    let idStatus: 'OPTIMAL' | 'WARNING' | 'CRITICAL' | 'NOT_ASSESSED' = idAssessed ? 'OPTIMAL' : 'NOT_ASSESSED';

    if (!idAssessed) {
      idDeductions.push('No Identity/Directory telemetry connected (Not assessed).');
      idAdvice.push('Connect Microsoft 365 or Google Workspace integration to assess identity posture.');
    } else {
      idScore = 100;
      const mfaPct = orgIdentity.mfaCoveragePercent;
      if (mfaPct >= 95) {
        idPositives.push(`Strong MFA coverage across identity directory (${mfaPct}%)`);
      } else {
        const penalty = Math.round((95 - mfaPct) * 0.7);
        idScore -= penalty;
        idDeductions.push(`MFA not enforced for all accounts (${mfaPct}% coverage) [-${penalty} pts]`);
        idAdvice.push('Mandate hardware/authenticator app MFA across all user and administrative accounts.');
      }

      if (orgIdentity.impossibleTravelEvents > 0) {
        idScore -= 20;
        idDeductions.push(`${orgIdentity.impossibleTravelEvents} impossible-travel anomalies logged in 24h [-20 pts]`);
        idAdvice.push('Review compromised credentials and enforce conditional access geo-fencing.');
      }
      idScore = Math.max(0, Math.min(100, idScore));
      idStatus = idScore >= 80 ? 'OPTIMAL' : (idScore >= 50 ? 'WARNING' : 'CRITICAL');
    }

    // 4. Data Protection & Backup Health (Weight: 15%)
    const bkpAssessed = orgBackups.length > 0;
    let bkpScore = 0;
    const bkpPositives: string[] = [];
    const bkpDeductions: string[] = [];
    const bkpAdvice: string[] = [];
    let bkpStatus: 'OPTIMAL' | 'WARNING' | 'CRITICAL' | 'NOT_ASSESSED' = bkpAssessed ? 'OPTIMAL' : 'NOT_ASSESSED';

    if (!bkpAssessed) {
      bkpDeductions.push('No enterprise backup integrations registered (Not assessed).');
      bkpAdvice.push('Connect Veeam, Acronis or AWS Backup to monitor disaster recovery health.');
    } else {
      bkpScore = 100;
      if (backupFailures > 0) {
        const penalty = backupFailures * 30;
        bkpScore -= penalty;
        bkpDeductions.push(`${backupFailures} critical backup jobs failed or RPO breached [-${penalty} pts]`);
        bkpAdvice.push('Investigate failing backup target and perform restore validation test.');
      } else {
        bkpPositives.push('All registered backup targets meeting Recovery Point Objectives (RPO)');
      }
      bkpScore = Math.max(0, Math.min(100, bkpScore));
      bkpStatus = bkpScore >= 80 ? 'OPTIMAL' : (bkpScore >= 50 ? 'WARNING' : 'CRITICAL');
    }

    // 5. Perimeter & Network Security (Weight: 15%)
    let netScore = 100;
    const netPositives: string[] = [];
    const netDeductions: string[] = [];
    const netAdvice: string[] = [];

    const openIncs = orgIncidents.filter(i => i.severity === 'CRITICAL' && i.status !== 'CLOSED').length;
    if (openIncs > 0) {
      netScore -= openIncs * 25;
      netDeductions.push(`${openIncs} Active Critical Security Incidents in triage/containment [-${openIncs * 25} pts]`);
      netAdvice.push('Complete incident containment playbooks and eradicate threat persistence.');
    } else {
      netPositives.push('Zero active critical perimeter breaches');
    }
    netScore = Math.max(0, Math.min(100, netScore));

    // 6. External Exposure & Certificates (Weight: 10%)
    let certScore = 100;
    const certPositives: string[] = [];
    const certDeductions: string[] = [];
    const certAdvice: string[] = [];

    if (expiringCerts > 0) {
      const penalty = expiringCerts * 20;
      certScore -= penalty;
      certDeductions.push(`${expiringCerts} SSL/TLS certificates expiring within 14 days [-${penalty} pts]`);
      certAdvice.push('Renew customer SSL certificates and deploy to load balancers before expiration.');
    } else {
      certPositives.push('All SSL/TLS certificates valid with modern cipher suites');
    }

    const invalidDns = orgDomains.filter(d => !d.spfValid || !d.dmarcValid).length;
    if (invalidDns > 0) {
      certScore -= 15;
      certDeductions.push(`${invalidDns} domain(s) have unverified SPF or DMARC email authentication [-15 pts]`);
      certAdvice.push('Publish strict SPF and DMARC reject policies to prevent domain spoofing.');
    } else {
      certPositives.push('Email domain security (SPF, DKIM, DMARC) properly configured');
    }
    certScore = Math.max(0, Math.min(100, certScore));

    const factors: PostureScoreFactor[] = [
      {
        category: 'Endpoint & Patch Compliance',
        weight: 0.25,
        score: endpointScore,
        status: endpointScore >= 80 ? 'OPTIMAL' : (endpointScore >= 50 ? 'WARNING' : 'CRITICAL'),
        assessed: true,
        positivePoints: endpointPositives,
        deductions: endpointDeductions,
        remediationAdvice: endpointAdvice
      },
      {
        category: 'Vulnerability Management',
        weight: 0.20,
        score: vulnScore,
        status: vulnScore >= 80 ? 'OPTIMAL' : (vulnScore >= 50 ? 'WARNING' : 'CRITICAL'),
        assessed: true,
        positivePoints: vulnPositives,
        deductions: vulnDeductions,
        remediationAdvice: vulnAdvice
      },
      {
        category: 'Identity & Access Security',
        weight: 0.15,
        score: idScore,
        status: idStatus,
        assessed: idAssessed,
        positivePoints: idPositives,
        deductions: idDeductions,
        remediationAdvice: idAdvice
      },
      {
        category: 'Backup & Disaster Recovery',
        weight: 0.15,
        score: bkpScore,
        status: bkpStatus,
        assessed: bkpAssessed,
        positivePoints: bkpPositives,
        deductions: bkpDeductions,
        remediationAdvice: bkpAdvice
      },
      {
        category: 'Perimeter & Incident Status',
        weight: 0.15,
        score: netScore,
        status: netScore >= 80 ? 'OPTIMAL' : (netScore >= 50 ? 'WARNING' : 'CRITICAL'),
        assessed: true,
        positivePoints: netPositives,
        deductions: netDeductions,
        remediationAdvice: netAdvice
      },
      {
        category: 'Certificates & Domain Security',
        weight: 0.10,
        score: certScore,
        status: certScore >= 80 ? 'OPTIMAL' : (certScore >= 50 ? 'WARNING' : 'CRITICAL'),
        assessed: true,
        positivePoints: certPositives,
        deductions: certDeductions,
        remediationAdvice: certAdvice
      }
    ];

    const assessedFactors = factors.filter(f => f.assessed);
    const totalAssessedWeight = assessedFactors.reduce((sum, f) => sum + f.weight, 0);
    const overallScore = totalAssessedWeight > 0
      ? Math.round(assessedFactors.reduce((sum, f) => sum + (f.score * (f.weight / totalAssessedWeight)), 0))
      : 0;

    let grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F' = 'F';
    if (overallScore >= 95) grade = 'A+';
    else if (overallScore >= 85) grade = 'A';
    else if (overallScore >= 75) grade = 'B';
    else if (overallScore >= 65) grade = 'C';
    else if (overallScore >= 50) grade = 'D';
    else grade = 'F';

    return {
      organizationId: orgId,
      overallScore,
      grade,
      criticalFindings: openCritVulns + (openIncs > 0 ? 1 : 0),
      highFindings: openHighVulns + (expiringCerts > 0 ? 1 : 0),
      mediumFindings: missingPatches,
      lowFindings: offlineAssets,
      openIncidents,
      unresolvedAlerts,
      vulnerableEndpoints: criticalVulns.length,
      missingPatches,
      offlineEndpoints: offlineAssets,
      backupFailures,
      expiringCertificates: expiringCerts,
      expiringDomains,
      factors,
      lastCalculated: new Date().toISOString()
    };
  }
}

export const db = new DatabaseStore();
