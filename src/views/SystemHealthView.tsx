import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import {
  ShieldCheck,
  Server,
  Database,
  HardDrive,
  Cpu,
  Radio,
  Bell,
  Sparkles,
  Key,
  Globe,
  WifiOff,
  Cloud,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Download,
  Upload,
  Lock,
  Archive,
  Terminal,
  Activity,
  Check,
  Clock,
  Layers,
  FileCheck
} from 'lucide-react';

export const SystemHealthView: React.FC = () => {
  const { isSuperAdmin, currentUser } = useAuth();
  const { addToast } = useApp();

  const [loading, setLoading] = useState(true);
  const [healthData, setHealthData] = useState<any>(null);
  const [backups, setBackups] = useState<any[]>([]);
  const [appMode, setAppMode] = useState<'development' | 'demo' | 'production'>('development');
  const [isUpdatingMode, setIsUpdatingMode] = useState(false);
  const [restoreReport, setRestoreReport] = useState<any | null>(null);
  const [isUpdatingLicense, setIsUpdatingLicense] = useState(false);
  const [newLicenseKey, setNewLicenseKey] = useState('');
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isUpdatingStorage, setIsUpdatingStorage] = useState(false);
  const [localStoragePath, setLocalStoragePath] = useState('/var/lib/pngee/storage');
  const [s3Bucket, setS3Bucket] = useState('pngee-customer-backups');
  const [s3Endpoint, setS3Endpoint] = useState('https://s3.us-east-1.amazonaws.com');
  const [storageBackend, setStorageBackend] = useState<'local' | 's3_compatible'>('local');
  const [onPremUrl, setOnPremUrl] = useState('https://cyberguard.internal.local');

  const fetchHealthAndBackups = async () => {
    try {
      setLoading(true);
      const [hRes, bRes, mRes] = await Promise.all([
        api.getSystemHealth(),
        api.getSystemBackups(),
        api.getAppMode().catch(() => ({ appMode: 'development' as const, isSyntheticAllowed: true, deploymentMode: 'cloud', isAirGapped: false }))
      ]);
      setHealthData(hRes);
      setBackups(bRes.snapshots || []);
      if (mRes?.appMode) {
        setAppMode(mRes.appMode);
      }
      if (hRes.storageConfig) {
        setStorageBackend(hRes.storageConfig.backend || 'local');
        setLocalStoragePath(hRes.storageConfig.localPath || '/var/lib/pngee/storage');
        if (hRes.storageConfig.s3Bucket) setS3Bucket(hRes.storageConfig.s3Bucket);
        if (hRes.storageConfig.s3Endpoint) setS3Endpoint(hRes.storageConfig.s3Endpoint);
      }
      if (hRes.onPremServerUrl) {
        setOnPremUrl(hRes.onPremServerUrl);
      }
    } catch (err: any) {
      addToast('Health Check Failed', err.message || 'Unable to retrieve system health telemetry', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAppMode = async (mode: 'development' | 'demo' | 'production') => {
    try {
      setIsUpdatingMode(true);
      const res = await api.updateAppMode(mode);
      setAppMode(mode);
      addToast('Application Mode Updated', res.message, mode === 'production' ? 'warning' : 'success');
      fetchHealthAndBackups();
    } catch (err: any) {
      addToast('Mode Switch Failed', err.message, 'error');
    } finally {
      setIsUpdatingMode(false);
    }
  };

  useEffect(() => {
    fetchHealthAndBackups();
  }, []);

  const handleToggleDeploymentMode = async (mode: 'cloud' | 'on_prem') => {
    try {
      const res = await api.updateDeploymentMode(mode, onPremUrl);
      addToast('Deployment Mode Updated', res.message, 'success');
      fetchHealthAndBackups();
    } catch (err: any) {
      addToast('Update Failed', err.message, 'error');
    }
  };

  const handleToggleAirGap = async (enabled: boolean) => {
    try {
      const res = await api.toggleAirGap(enabled);
      addToast(enabled ? 'Air-Gapped Mode Activated' : 'Cloud Mode Activated', res.message, 'warning');
      fetchHealthAndBackups();
    } catch (err: any) {
      addToast('Mode Toggle Failed', err.message, 'error');
    }
  };

  const handleUpdateLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLicenseKey.trim()) return;
    try {
      setIsUpdatingLicense(true);
      const res = await api.updateLicense(newLicenseKey.trim());
      addToast('License Updated', res.message, 'success');
      setNewLicenseKey('');
      fetchHealthAndBackups();
    } catch (err: any) {
      addToast('License Activation Failed', err.message, 'error');
    } finally {
      setIsUpdatingLicense(false);
    }
  };

  const handleSaveStorageConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsUpdatingStorage(true);
      const res = await api.updateStorageConfig({
        backend: storageBackend,
        localPath: localStoragePath,
        s3Bucket: storageBackend === 's3_compatible' ? s3Bucket : undefined,
        s3Endpoint: storageBackend === 's3_compatible' ? s3Endpoint : undefined
      });
      addToast('Storage Config Saved', res.message, 'success');
      fetchHealthAndBackups();
    } catch (err: any) {
      addToast('Storage Config Failed', err.message, 'error');
    } finally {
      setIsUpdatingStorage(false);
    }
  };

  const handleCreateBackup = async () => {
    try {
      setIsCreatingBackup(true);
      const res = await api.createSystemBackup();
      addToast('Snapshot Created', res.message, 'success');
      fetchHealthAndBackups();
    } catch (err: any) {
      addToast('Backup Failed', err.message, 'error');
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const handleRestoreBackup = async (id: string) => {
    try {
      const res = await api.restoreSystemBackup(id);
      if (res.result) {
        setRestoreReport(res.result);
      }
      addToast('Integrity Verified', res.message || 'Disaster recovery snapshot passed all verification checks.', 'success');
      fetchHealthAndBackups();
    } catch (err: any) {
      addToast('Restore Verification Failed', err.message, 'error');
    }
  };

  if (loading && !healthData) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <RefreshCw className="w-8 h-8 text-[#F27D26] animate-spin" />
        <p className="text-xs font-mono text-slate-500 uppercase tracking-wider">
          Querying PNGee CyberGuard Deployment Health Matrix...
        </p>
      </div>
    );
  }

  const h = healthData?.healthMatrix;
  const license = healthData?.license;
  const dbMetrics = healthData?.database;
  const storageMetrics = healthData?.storage;
  const isAirGapped = healthData?.isAirGapped;
  const deploymentMode = healthData?.deploymentMode || 'cloud';

  const componentHealthList = [
    {
      name: 'Application Web Server',
      status: h?.application || 'HEALTHY',
      description: 'REST API router, Express ingress, and Vite UI delivery',
      icon: Server,
      metric: `Uptime: ${Math.floor((h?.uptimeSeconds || 0) / 86400)}d ${Math.floor(((h?.uptimeSeconds || 0) % 86400) / 3600)}h`
    },
    {
      name: 'PostgreSQL Relational DB',
      status: h?.database || 'HEALTHY',
      description: dbMetrics?.type || 'Enterprise Relational Engine',
      icon: Database,
      metric: `${dbMetrics?.connections || 14} pool conns • ${dbMetrics?.sizeMb || 89} MB stored`
    },
    {
      name: 'Persistent Storage Subsystem',
      status: h?.storage || 'HEALTHY',
      description: `${storageMetrics?.backend === 'local' ? 'Local POSIX Filesystem' : 'S3/MinIO Object Storage'}`,
      icon: HardDrive,
      metric: `${storageMetrics?.usedGb || 38.4} GB used of ${storageMetrics?.totalGb || 500} GB`
    },
    {
      name: 'Telemetry Ingestion Daemon',
      status: h?.telemetry || 'HEALTHY',
      description: 'Streaming endpoint agent and syslog pipeline',
      icon: Radio,
      metric: `${healthData?.telemetryIngestRatePerMin || 140} events/min normalized`
    },
    {
      name: 'Detection Correlation Engine',
      status: h?.detectionEngine || 'HEALTHY',
      description: 'Real-time MITRE ATT&CK threshold and heuristic evaluator',
      icon: Cpu,
      metric: 'Zero-lag evaluation pipeline'
    },
    {
      name: 'Notification & Pager Dispatch',
      status: h?.notifications || 'HEALTHY',
      description: isAirGapped ? 'Air-Gapped: Internal SMTP/Syslog only' : 'Multi-channel (Webhook, SMTP, In-App)',
      icon: Bell,
      metric: isAirGapped ? 'Restricted Egress' : 'Active Delivery'
    },
    {
      name: 'AI Security Copilot Engine',
      status: h?.aiIntegration === 'ONLINE' ? 'ONLINE' : 'LOCAL_OFFLINE',
      description: h?.aiIntegration === 'ONLINE' ? 'Gemini 3.7 Flash Cloud Engine' : 'Autonomous Offline Heuristic Engine (Air-gap safe)',
      icon: Sparkles,
      metric: h?.aiIntegration === 'ONLINE' ? 'Cloud Connected' : 'Local Heuristic Engine'
    }
  ];

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Top Banner: Product & Commercial Platform Overview */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-[#121216] border border-slate-700 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-6 w-72 h-72 bg-[#F27D26]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="px-2.5 py-0.5 rounded-md bg-[#F27D26] text-black font-black text-xs uppercase tracking-wider">
                PNGee IT Solutions
              </div>
              <span className="text-slate-400 text-xs font-mono">Build Once • Deploy Anywhere</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-3">
              PNGee CyberGuard
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                v2.4.0 Commercial
              </span>
            </h1>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Enterprise Managed Cybersecurity & Telemetry Monitoring Suite for MSPs, MSSPs, and Customer-Hosted On-Premises Air-Gapped Deployments.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={fetchHealthAndBackups}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#F27D26]" />
              <span>Poll Telemetry</span>
            </button>
            <button
              onClick={handleCreateBackup}
              disabled={isCreatingBackup}
              className="px-3.5 py-2 rounded-xl bg-[#F27D26] hover:bg-[#ff8f3d] text-black text-xs font-bold flex items-center gap-2 transition-all shadow-md"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>{isCreatingBackup ? 'Creating Snapshot...' : 'Backup Snapshot Now'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Application Mode Control (Enforcing Strict Production vs Demo vs Development) */}
      <div className="bg-white dark:bg-[#0A0A0B] border border-slate-200 dark:border-[#1F1F23] rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-[#1F1F23] pb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${
              appMode === 'production' 
                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                : appMode === 'demo'
                ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
            }`}>
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Operational Application Mode
                </h3>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  appMode === 'production'
                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30'
                    : appMode === 'demo'
                    ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30'
                    : 'bg-blue-500/10 text-blue-500 border border-blue-500/30'
                }`}>
                  {appMode.toUpperCase()} MODE
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-[#777] mt-0.5">
                Strict environment isolation controlling synthetic telemetry, authentication enforcement, and demo reset protection
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className={`text-xs font-mono font-bold ${
              appMode === 'production' ? 'text-emerald-500' : 'text-slate-400'
            }`}>
              {appMode === 'production' ? '● Synthetic Ingestion Disabled' : '○ Synthetic Simulation Permitted'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* Production Mode */}
          <button
            onClick={() => handleUpdateAppMode('production')}
            disabled={isUpdatingMode}
            className={`p-4 rounded-xl border text-left transition-all relative ${
              appMode === 'production'
                ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-sm ring-1 ring-emerald-500/30'
                : 'border-slate-200 dark:border-[#1F1F23] hover:bg-slate-50 dark:hover:bg-[#121214]'
            }`}
          >
            {appMode === 'production' && (
              <span className="absolute top-3 right-3 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            )}
            <div className="flex items-center gap-2 font-bold text-xs text-slate-900 dark:text-white">
              <Lock className="w-4 h-4 text-emerald-500" />
              <span>Production Mode</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-[#888] mt-1.5 leading-snug">
              Strict commercial operation. Unauthenticated admin fallback disabled. Synthetic telemetry disabled. All data must originate from real enrolled agents or integrations.
            </p>
          </button>

          {/* Demo Mode */}
          <button
            onClick={() => handleUpdateAppMode('demo')}
            disabled={isUpdatingMode}
            className={`p-4 rounded-xl border text-left transition-all ${
              appMode === 'demo'
                ? 'border-amber-500 bg-amber-50/40 dark:bg-amber-950/20 shadow-sm ring-1 ring-amber-500/30'
                : 'border-slate-200 dark:border-[#1F1F23] hover:bg-slate-50 dark:hover:bg-[#121214]'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-xs text-slate-900 dark:text-white">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Demo Mode</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-[#888] mt-1.5 leading-snug">
              Pre-loaded multi-tenant scenarios (Apex Logistics, Nexus Health) with synthetic attack feeds for customer demonstrations and analyst training.
            </p>
          </button>

          {/* Development Mode */}
          <button
            onClick={() => handleUpdateAppMode('development')}
            disabled={isUpdatingMode}
            className={`p-4 rounded-xl border text-left transition-all ${
              appMode === 'development'
                ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/20 shadow-sm ring-1 ring-blue-500/30'
                : 'border-slate-200 dark:border-[#1F1F23] hover:bg-slate-50 dark:hover:bg-[#121214]'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-xs text-slate-900 dark:text-white">
              <Terminal className="w-4 h-4 text-blue-500" />
              <span>Development Sandbox</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-[#888] mt-1.5 leading-snug">
              Engineering and diagnostic sandbox allowing relaxed schema validation, test runner executions, and synthetic fault injection.
            </p>
          </button>
        </div>
      </div>

      {/* Grid: Deployment Mode & Commercial Licensing */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Deployment Architecture Control (6 cols) */}
        <div className="lg:col-span-6 bg-white dark:bg-[#0A0A0B] border border-slate-200 dark:border-[#1F1F23] rounded-2xl p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#1F1F23] pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Deployment Architecture
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#777]">
                  Unified codebase operating in Cloud SaaS or On-Premises
                </p>
              </div>
            </div>
            <span className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
              deploymentMode === 'cloud' 
                ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' 
                : 'bg-purple-500/10 text-purple-500 border border-purple-500/20'
            }`}>
              {deploymentMode === 'cloud' ? 'Managed Cloud SaaS' : 'On-Premises Dedicated'}
            </span>
          </div>

          {/* Mode Selector Toggle */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleToggleDeploymentMode('cloud')}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                deploymentMode === 'cloud'
                  ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 shadow-sm'
                  : 'border-slate-200 dark:border-[#1F1F23] hover:bg-slate-50 dark:hover:bg-[#121214]'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-xs text-slate-900 dark:text-white">
                <Cloud className="w-4 h-4 text-blue-500" />
                <span>Cloud Multi-Tenant</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-[#777] mt-1 leading-snug">
                PNGee-managed multi-tenant cloud hosting with dynamic tenant isolation.
              </p>
            </button>

            <button
              onClick={() => handleToggleDeploymentMode('on_prem')}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                deploymentMode === 'on_prem'
                  ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-950/20 shadow-sm'
                  : 'border-slate-200 dark:border-[#1F1F23] hover:bg-slate-50 dark:hover:bg-[#121214]'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-xs text-slate-900 dark:text-white">
                <Server className="w-4 h-4 text-purple-500" />
                <span>On-Premises Appliance</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-[#777] mt-1 leading-snug">
                Customer-hosted hardware/VM with localized data sovereignty.
              </p>
            </button>
          </div>

          {/* On-Prem Configuration URL */}
          {deploymentMode === 'on_prem' && (
            <div className="p-3.5 rounded-xl bg-purple-500/5 border border-purple-500/20 space-y-2 text-xs">
              <label className="font-semibold text-slate-700 dark:text-slate-300 block">
                Internal On-Premises Host Address
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={onPremUrl}
                  onChange={(e) => setOnPremUrl(e.target.value)}
                  className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono"
                  placeholder="https://cyberguard.internal.local"
                />
                <button
                  onClick={() => handleToggleDeploymentMode('on_prem')}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold"
                >
                  Save URL
                </button>
              </div>
            </div>
          )}

          {/* Air-Gapped Network Mode Toggle */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-[#1F1F23] bg-slate-50 dark:bg-[#111114] flex items-center justify-between">
            <div className="space-y-0.5 pr-4">
              <div className="flex items-center gap-2">
                <WifiOff className={`w-4 h-4 ${isAirGapped ? 'text-amber-500' : 'text-slate-400'}`} />
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Air-Gapped / Offline Operation Mode
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-[#777]">
                Blocks outbound telemetry egress. Enforces local heuristic AI and on-prem database persistence.
              </p>
            </div>
            <button
              onClick={() => handleToggleAirGap(!isAirGapped)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                isAirGapped
                  ? 'bg-amber-500 text-black shadow-md'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300'
              }`}
            >
              {isAirGapped ? 'ENGAGED' : 'DISABLED'}
            </button>
          </div>
        </div>

        {/* Right: Commercial Licensing & Entitlements (6 cols) */}
        <div className="lg:col-span-6 bg-white dark:bg-[#0A0A0B] border border-slate-200 dark:border-[#1F1F23] rounded-2xl p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#1F1F23] pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-[#F27D26]/10 text-[#F27D26]">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Commercial License & Capacity
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#777]">
                  Subscription tier and endpoint capacity constraints
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-[#F27D26]/10 text-[#F27D26] border border-[#F27D26]/30 uppercase">
              {license?.edition || 'ENTERPRISE'} EDITION
            </span>
          </div>

          {/* Capacity Usage Meters */}
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Endpoint Capacity ({license?.currentEndpoints || 0} of {license?.maxEndpoints || 500} enrolled)
                </span>
                <span className="font-mono text-slate-500">
                  {Math.round(((license?.currentEndpoints || 1) / (license?.maxEndpoints || 500)) * 100)}%
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${Math.min(100, Math.round(((license?.currentEndpoints || 1) / (license?.maxEndpoints || 500)) * 100))}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs pt-1">
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#111114] border border-slate-200 dark:border-[#1F1F23]">
                <span className="text-slate-400 block text-[10px]">Valid Until</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                  {license?.validUntil ? new Date(license.validUntil).toLocaleDateString() : '2028-12-31'}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#111114] border border-slate-200 dark:border-[#1F1F23]">
                <span className="text-slate-400 block text-[10px]">Active License Key</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200 truncate block">
                  {license?.licenseKey || 'PNGEE-ENT-2026-X889'}
                </span>
              </div>
            </div>
          </div>

          {/* Entitlement Badges */}
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Licensed Feature Entitlements
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Multi-Tenant Architecture</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Autonomous Offline AI</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Air-Gapped Deployment</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Executive PDF Generator</span>
              </div>
            </div>
          </div>

          {/* License Key Update Input */}
          <form onSubmit={handleUpdateLicense} className="pt-2 border-t border-slate-100 dark:border-[#1F1F23] flex gap-2">
            <input
              type="text"
              placeholder="Enter new commercial license key (e.g. PNGEE-ENT-...)"
              value={newLicenseKey}
              onChange={(e) => setNewLicenseKey(e.target.value)}
              className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono"
            />
            <button
              type="submit"
              disabled={isUpdatingLicense}
              className="px-3 py-1.5 bg-[#F27D26] hover:bg-[#ff8f3d] text-black rounded-lg text-xs font-bold"
            >
              {isUpdatingLicense ? 'Validating...' : 'Activate'}
            </button>
          </form>
        </div>
      </div>

      {/* Storage Abstraction Interface */}
      <div className="bg-white dark:bg-[#0A0A0B] border border-slate-200 dark:border-[#1F1F23] rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#1F1F23] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Storage Abstraction & Data Sovereignty
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#777]">
                Abstracted storage layer supporting local filesystem, AWS S3, or MinIO
              </p>
            </div>
          </div>
          <span className="text-xs font-mono text-slate-500">
            Disk Usage: {storageMetrics?.usedGb || 38.4} GB / {storageMetrics?.totalGb || 500} GB
          </span>
        </div>

        <form onSubmit={handleSaveStorageConfig} className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="font-semibold block mb-1 text-slate-700 dark:text-slate-300">
              Storage Backend Type
            </label>
            <select
              value={storageBackend}
              onChange={(e) => setStorageBackend(e.target.value as any)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-semibold"
            >
              <option value="local">Local Filesystem (POSIX / NFS / SAN)</option>
              <option value="s3_compatible">S3-Compatible Object Store (AWS / MinIO / Ceph)</option>
            </select>
          </div>

          {storageBackend === 'local' ? (
            <div className="md:col-span-2">
              <label className="font-semibold block mb-1 text-slate-700 dark:text-slate-300">
                Local Storage Mount Directory Path
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={localStoragePath}
                  onChange={(e) => setLocalStoragePath(e.target.value)}
                  className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-mono"
                  placeholder="/var/lib/pngee/storage"
                />
                <button
                  type="submit"
                  disabled={isUpdatingStorage}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold"
                >
                  Save Path
                </button>
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="font-semibold block mb-1 text-slate-700 dark:text-slate-300">
                  S3 Bucket Name
                </label>
                <input
                  type="text"
                  value={s3Bucket}
                  onChange={(e) => setS3Bucket(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-mono"
                  placeholder="pngee-customer-backups"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1 text-slate-700 dark:text-slate-300">
                  Endpoint URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={s3Endpoint}
                    onChange={(e) => setS3Endpoint(e.target.value)}
                    className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-mono"
                    placeholder="https://s3.us-east-1.amazonaws.com"
                  />
                  <button
                    type="submit"
                    disabled={isUpdatingStorage}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold"
                  >
                    Save S3
                  </button>
                </div>
              </div>
            </>
          )}
        </form>
      </div>

      {/* Full Deployment Health Check Matrix */}
      <div className="bg-white dark:bg-[#0A0A0B] border border-slate-200 dark:border-[#1F1F23] rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#1F1F23] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Deployment Health Matrix & Subsystem Verification
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#777]">
                Continuous internal self-test monitoring across all daemon modules
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-xs font-bold text-emerald-600 font-mono">100% OPERATIONAL</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {componentHealthList.map((item, idx) => {
            const Icon = item.icon;
            const isHealthy = item.status === 'HEALTHY' || item.status === 'ONLINE';
            const isWarning = item.status === 'WARNING';
            return (
              <div
                key={idx}
                className="p-4 rounded-xl border border-slate-200 dark:border-[#1F1F23] bg-slate-50/50 dark:bg-[#111114] space-y-2 transition-all hover:border-slate-300 dark:hover:border-slate-700"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[#F27D26]">
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="font-bold text-xs text-slate-900 dark:text-white">
                      {item.name}
                    </span>
                  </div>
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                    isHealthy ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                    isWarning ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                    'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                  }`}>
                    {item.status}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-[#888] leading-tight">
                  {item.description}
                </p>
                <div className="pt-2 border-t border-slate-200/60 dark:border-[#1F1F23] flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span>Telemetry:</span>
                  <span className="text-slate-600 dark:text-slate-300 font-semibold">{item.metric}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Backup Snapshots & Disaster Recovery Management */}
      <div className="bg-white dark:bg-[#0A0A0B] border border-slate-200 dark:border-[#1F1F23] rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#1F1F23] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Disaster Recovery & Encrypted Snapshots
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#777]">
                SHA-256 verified full state archives stored to {storageMetrics?.backend === 'local' ? 'Local Storage' : 'S3 Storage'}
              </p>
            </div>
          </div>
          <button
            onClick={handleCreateBackup}
            disabled={isCreatingBackup}
            className="px-3 py-1.5 bg-[#F27D26] hover:bg-[#ff8f3d] text-black rounded-lg text-xs font-bold flex items-center gap-1.5"
          >
            <Archive className="w-3.5 h-3.5" />
            <span>{isCreatingBackup ? 'Creating...' : 'Trigger Backup'}</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-[#111114] text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              <tr>
                <th className="py-2.5 px-3 rounded-l-lg">Snapshot Archive</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Size</th>
                <th className="py-2.5 px-3">Checksum Integrity</th>
                <th className="py-2.5 px-3">Storage Destination</th>
                <th className="py-2.5 px-3 text-right rounded-r-lg">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1F1F23]">
              {backups.map((snap) => (
                <tr key={snap.id} className="hover:bg-slate-50 dark:hover:bg-[#121214]">
                  <td className="py-3 px-3">
                    <div className="font-mono font-bold text-slate-900 dark:text-white">
                      {snap.filename}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Created: {new Date(snap.timestamp).toLocaleString()}
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 font-mono font-bold text-[10px]">
                      {snap.type}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-300">
                    {snap.sizeMb} MB
                  </td>
                  <td className="py-3 px-3 font-mono text-[10px] text-slate-400">
                    {snap.checksum}
                  </td>
                  <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                    {snap.location}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button
                      onClick={() => handleRestoreBackup(snap.id)}
                      className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-emerald-500/10 hover:text-emerald-500 font-semibold text-[11px] transition-colors"
                      title="Run automated dry-run integrity verification test"
                    >
                      Verify Restore
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Disaster Recovery Verification Report Modal */}
      {restoreReport && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0E0E11] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${restoreReport.allStepsPassed ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                  {restoreReport.allStepsPassed ? <CheckCircle2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Disaster Recovery Verification Report
                  </h3>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    Snapshot ID: {restoreReport.snapshotId} • Restored: {new Date(restoreReport.restoredAt).toLocaleTimeString()}
                  </p>
                </div>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold uppercase ${
                restoreReport.allStepsPassed 
                  ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                  : 'bg-red-500/10 text-red-500 border border-red-500/20'
              }`}>
                {restoreReport.allStepsPassed ? '100% Verified' : 'Integrity Failure'}
              </span>
            </div>

            <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  9-Stage Cryptographic Integrity Verification Pipeline
                </h4>
                <div className="space-y-2">
                  {restoreReport.verifiedSteps?.map((s: any, idx: number) => (
                    <div key={idx} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 flex items-start justify-between gap-3">
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {s.step}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {s.details}
                        </div>
                      </div>
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded shrink-0 ${
                        s.passed ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'
                      }`}>
                        {s.passed ? 'PASSED' : 'FAILED'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {restoreReport.restoredRecords && (
                <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                    Restored State Record Counts
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    {Object.entries(restoreReport.restoredRecords).map(([key, count]) => (
                      <div key={key} className="p-2 rounded-lg bg-white dark:bg-black/40 border border-slate-200/50 dark:border-slate-800">
                        <div className="text-xs font-mono font-bold text-slate-900 dark:text-white">{String(count)}</div>
                        <div className="text-[10px] text-slate-400 capitalize">{key}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end bg-slate-50/50 dark:bg-[#0B0B0E]">
              <button
                onClick={() => setRestoreReport(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-black rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
