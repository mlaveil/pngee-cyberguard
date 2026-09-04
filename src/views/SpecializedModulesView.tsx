import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import {
  SslCertificate,
  MonitoredDomain,
  BackupRecord,
  ExternalExposureRecord,
  IdentityAuthStat
} from '../types';
import {
  Lock,
  Globe2,
  HardDriveDownload,
  KeyRound,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';

export const SpecializedModulesView: React.FC = () => {
  const { selectedOrgId, refreshTrigger } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'CERTS' | 'DOMAINS' | 'BACKUPS' | 'IDENTITY' | 'EXPOSURE'>('CERTS');
  const [certs, setCerts] = useState<SslCertificate[]>([]);
  const [domains, setDomains] = useState<MonitoredDomain[]>([]);
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [identities, setIdentities] = useState<IdentityAuthStat[]>([]);
  const [exposures, setExposures] = useState<ExternalExposureRecord[]>([]);

  useEffect(() => {
    const loadModules = async () => {
      try {
        const [cData, dData, bData, iData, eData] = await Promise.all([
          api.getCertificates(),
          api.getDomains(),
          api.getBackups(),
          api.getIdentity(),
          api.getExposure()
        ]);
        setCerts(cData);
        setDomains(dData);
        setBackups(bData);
        setIdentities(iData);
        setExposures(eData);
      } catch (err) {
        console.error('Failed to load specialized modules:', err);
      }
    };
    loadModules();
  }, [selectedOrgId, refreshTrigger]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
          Specialized Monitoring & Defense Modules
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Disaster recovery backups, SSL/TLS certificate expiries, DNS spoofing protections, and identity hygiene
        </p>
      </div>

      {/* Sub Tabs */}
      <div className="flex flex-wrap items-center border-b border-slate-200 dark:border-slate-800 text-xs font-semibold gap-2 sm:gap-6">
        <button
          onClick={() => setActiveSubTab('CERTS')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-all ${
            activeSubTab === 'CERTS'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>SSL/TLS Certificates ({certs.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('DOMAINS')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-all ${
            activeSubTab === 'DOMAINS'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Globe2 className="w-4 h-4" />
          <span>Domain & Email Security ({domains.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('BACKUPS')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-all ${
            activeSubTab === 'BACKUPS'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <HardDriveDownload className="w-4 h-4" />
          <span>Backup & Disaster Recovery ({backups.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('IDENTITY')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-all ${
            activeSubTab === 'IDENTITY'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <KeyRound className="w-4 h-4" />
          <span>Identity & MFA Coverage</span>
        </button>

        <button
          onClick={() => setActiveSubTab('EXPOSURE')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-all ${
            activeSubTab === 'EXPOSURE'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>External Attack Surface ({exposures.length})</span>
        </button>
      </div>

      {/* 1. SSL/TLS CERTIFICATES */}
      {activeSubTab === 'CERTS' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Domain / Hostname</th>
                  <th className="px-4 py-3">Certificate Authority</th>
                  <th className="px-4 py-3">Valid Until</th>
                  <th className="px-4 py-3">Days Remaining</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {certs.map(cert => {
                  const validDate = cert.validUntil || (cert as any).validTo || cert.lastChecked || new Date().toISOString();
                  return (
                    <tr key={cert.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-white font-mono text-xs">
                        {cert.domain}
                      </td>
                      <td className="px-4 py-3 font-sans text-slate-600 dark:text-slate-300">
                        {cert.issuer}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-[11px]">
                        {new Date(validDate).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-bold ${
                          cert.daysRemaining <= 14 ? 'text-rose-500 font-bold' :
                          cert.daysRemaining <= 30 ? 'text-amber-500' : 'text-emerald-500'
                        }`}>
                          {cert.daysRemaining} days
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase font-sans ${
                          cert.status === 'EXPIRING_SOON' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' :
                          'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                        }`}>
                          {cert.status ? cert.status.replace('_', ' ') : 'VALID'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. DOMAIN & EMAIL SECURITY */}
      {activeSubTab === 'DOMAINS' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Monitored Domain</th>
                  <th className="px-4 py-3">DNS Registrar</th>
                  <th className="px-4 py-3">SPF Validation</th>
                  <th className="px-4 py-3">DKIM</th>
                  <th className="px-4 py-3">DMARC Policy</th>
                  <th className="px-4 py-3">Domain Expiry</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {domains.map(dom => {
                  const dkimStatus = dom.dkimConfigured ?? (dom as any).dkimValid ?? false;
                  return (
                    <tr key={dom.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-white font-mono text-xs">
                        {dom.domainName}
                      </td>
                      <td className="px-4 py-3 font-sans text-slate-600 dark:text-slate-300">
                        {dom.registrar}
                      </td>
                      <td className="px-4 py-3 font-sans">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${dom.spfValid ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {dom.spfValid ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                          {dom.spfValid ? 'Valid SPF' : 'Missing SPF'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-sans">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${dkimStatus ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {dkimStatus ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                          {dkimStatus ? 'Configured' : 'Missing'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-sans">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${dom.dmarcValid ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {dom.dmarcValid ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                          {dom.dmarcRecord ? (dom.dmarcRecord.includes('p=reject') ? 'p=reject' : dom.dmarcRecord.includes('p=quarantine') ? 'p=quarantine' : 'p=none') : ((dom as any).dmarcPolicy || 'p=none')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-[11px]">
                        {dom.daysToExpiry} days remaining
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. BACKUP JOBS & DISASTER RECOVERY */}
      {activeSubTab === 'BACKUPS' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Protected Target</th>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Last Job Status</th>
                  <th className="px-4 py-3">Completed At</th>
                  <th className="px-4 py-3">Data Size</th>
                  <th className="px-4 py-3">RPO Compliance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {backups.map(bkp => {
                  const bkpDate = bkp.lastSuccessfulBackup || (bkp as any).lastBackupTime || bkp.lastChecked || new Date().toISOString();
                  const isRpoMet = bkp.recoveryPointStatus === 'RPO_MET' || bkp.recoveryPointStatus === 'COMPLIANT';
                  return (
                    <tr key={bkp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-white text-xs">
                        {bkp.protectedAssetName}
                      </td>
                      <td className="px-4 py-3 font-sans text-slate-600 dark:text-slate-300">
                        {bkp.backupSystem || (bkp as any).backupProvider || 'Veeam Backup'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase font-sans ${
                          bkp.status === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-500' :
                          bkp.status === 'FAILED' ? 'bg-rose-500/10 text-rose-500 font-bold' : 'bg-amber-500/10 text-amber-500'
                        }`}>
                          {bkp.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-[11px]">
                        {new Date(bkpDate).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {bkp.backupSizeBytes ? `${(bkp.backupSizeBytes / (1024 * 1024 * 1024)).toFixed(1)} GB` : '--'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-sans ${
                          isRpoMet ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                        }`}>
                          {isRpoMet ? '✅ Target Met (24h RPO)' : '❌ RPO Breached'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. IDENTITY & MFA */}
      {activeSubTab === 'IDENTITY' && (
        <div className="space-y-4">
          {identities.map(idStat => {
            const syncTime = (idStat as any).lastSyncTimestamp || '2026-09-01T22:30:00Z';
            const totalAccounts = (idStat as any).totalUsersCount || 54;
            const mfaEnforced = (idStat as any).mfaEnforcedCount || Math.round((totalAccounts * (idStat.mfaCoveragePercent || 0)) / 100);

            return (
              <div key={idStat.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <KeyRound className="w-5 h-5 text-blue-500" />
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white font-sans">
                      Directory Identity Hygiene & Anomaly Telemetry
                    </h3>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    Last Sync: {new Date(syncTime).toLocaleTimeString()}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-sans">
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-1">
                    <span className="text-slate-500 font-semibold">Total Accounts</span>
                    <div className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                      {totalAccounts}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                    <span className="text-emerald-700 dark:text-emerald-300 font-semibold">MFA Enforcement</span>
                    <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                      {idStat.mfaCoveragePercent}%
                    </div>
                    <div className="text-[11px] text-emerald-600">
                      {mfaEnforced} of {totalAccounts} accounts protected
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-1">
                    <span className="text-slate-500 font-semibold">Failed Logins (24h)</span>
                    <div className="text-2xl font-black font-mono text-amber-500">
                      {idStat.failedLogins ?? (idStat as any).failedLoginsPast24h ?? 0}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 space-y-1">
                    <span className="text-rose-700 dark:text-rose-300 font-semibold">Impossible Travel Events</span>
                    <div className="text-2xl font-black font-mono text-rose-600 dark:text-rose-400">
                      {idStat.impossibleTravelEvents ?? 0}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. EXTERNAL ATTACK SURFACE */}
      {activeSubTab === 'EXPOSURE' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">External IP / Host</th>
                  <th className="px-4 py-3">Open Port & Protocol</th>
                  <th className="px-4 py-3">Detected Service Banner</th>
                  <th className="px-4 py-3">Risk Assessment</th>
                  <th className="px-4 py-3">Last Scanned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {exposures.map(exp => {
                  const targetDisplay = exp.publicIp || exp.target || (exp as any).ipAddress || 'External Host';
                  const portsDisplay = exp.openPorts ? exp.openPorts.join(', ') : ((exp as any).port ? `${(exp as any).port}/${(exp as any).protocol || 'TCP'}` : '443');
                  const serviceDisplay = (exp.discoveredServices && exp.discoveredServices.join(', ')) || (exp as any).service || 'HTTPS Endpoint';
                  const grade = exp.threatExposureGrade || (exp as any).riskLevel || 'C';
                  const scanDate = exp.lastScanned || new Date().toISOString();

                  return (
                    <tr key={exp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-white text-xs">
                        {targetDisplay}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                        {portsDisplay}
                      </td>
                      <td className="px-4 py-3 font-sans text-slate-600 dark:text-slate-300">
                        {serviceDisplay}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-sans uppercase ${
                          grade === 'F' || grade === 'CRITICAL' ? 'bg-rose-500/10 text-rose-500' :
                          grade === 'D' || grade === 'HIGH' ? 'bg-orange-500/10 text-orange-500' :
                          grade === 'C' || grade === 'MEDIUM' ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'
                        }`}>
                          Grade {grade}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-[11px]">
                        {new Date(scanDate).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
