import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import {
  SecurityPosture,
  SecurityAlert,
  SecurityIncident,
  SecurityEvent,
  Asset,
  BackupRecord,
  SslCertificate
} from '../types';
import {
  Shield,
  ShieldAlert,
  Flame,
  Activity,
  Server,
  Sparkles,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  CheckCircle2,
  Info,
  Clock,
  Zap,
  ArrowUpRight,
  Search,
  Check,
  AlertTriangle
} from 'lucide-react';

interface DashboardViewProps {
  onOpenSimulator?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onOpenSimulator }) => {
  const { currentOrg, isSuperAdmin, isSecAnalyst } = useAuth();
  const { selectedOrgId, refreshTrigger, setActiveView, addToast, setIsAiModalOpen } = useApp();

  const [posture, setPosture] = useState<SecurityPosture | null>(null);
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [certificates, setCertificates] = useState<SslCertificate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter state for correlation trend
  const [trendFilter, setTrendFilter] = useState<'all' | 'auth' | 'malware' | 'identity'>('all');

  // Posture breakdown modal/drawer state
  const [showPostureBreakdown, setShowPostureBreakdown] = useState(false);
  const [summarizingAlertId, setSummarizingAlertId] = useState<string | null>(null);
  const [alertAiSummary, setAlertAiSummary] = useState<{ id: string; text: string } | null>(null);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      const [pData, aData, iData, eData, astData, bData, cData] = await Promise.all([
        api.getPostureScore(selectedOrgId === 'all' ? undefined : selectedOrgId),
        api.getAlerts(),
        api.getIncidents(),
        api.getEvents({ limit: 15 }),
        api.getAssets(),
        api.getBackups(),
        api.getCertificates()
      ]);

      setPosture(pData);
      setAlerts(aData);
      setIncidents(iData);
      setEvents(eData);
      setAssets(astData);
      setBackups(bData);
      setCertificates(cData);
    } catch (err: any) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [selectedOrgId, refreshTrigger]);

  const handleSummarizeAlert = async (alert: SecurityAlert) => {
    setSummarizingAlertId(alert.id);
    try {
      const res = await api.summarizeAlert(alert.id);
      setAlertAiSummary({ id: alert.id, text: res.summary });
    } catch (err: any) {
      addToast('AI Summary Error', err.message || 'Failed to generate alert summary', 'error');
    } finally {
      setSummarizingAlertId(null);
    }
  };

  const getGradeColor = (grade?: string) => {
    switch (grade) {
      case 'A+':
      case 'A':
        return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30';
      case 'B':
        return 'text-[#F27D26] bg-[#F27D26]/10 border-[#F27D26]/30';
      case 'C':
        return 'text-amber-500 bg-amber-500/10 border-amber-500/30';
      case 'D':
      case 'F':
      default:
        return 'text-red-500 bg-red-500/10 border-red-500/30';
    }
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'CRITICAL':
        return 'bg-red-500/10 text-red-500 border border-red-500/20';
      case 'HIGH':
        return 'bg-orange-500/10 text-orange-500 border border-orange-500/20';
      case 'MEDIUM':
        return 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20';
      case 'LOW':
        return 'bg-blue-500/10 text-blue-500 border border-blue-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
    }
  };

  const onlineAssets = assets.filter(a => a.status === 'ONLINE').length;
  const totalAssets = assets.length;
  const missingPatchesCount = assets.reduce((sum, a) => sum + (a.complianceStatus === 'NON_COMPLIANT' ? 1 : 0), 0) + (posture?.criticalFindings || 0);
  const failingBackups = backups.filter(b => b.status === 'FAILED' || b.recoveryPointStatus === 'RPO_BREACHED').length;
  const backupCoveragePct = backups.length > 0 ? Math.round(((backups.length - failingBackups) / backups.length) * 100) : 100;
  const criticalIncidentsCount = incidents.filter(i => i.severity === 'CRITICAL' && i.status !== 'CLOSED').length;
  const highIncidentsCount = incidents.filter(i => i.severity === 'HIGH' && i.status !== 'CLOSED').length;
  const investigatingIncidentsCount = incidents.filter(i => i.status === 'INVESTIGATING' || i.status === 'TRIAGE').length;

  // Histogram mock bars for Event Correlation Trend
  const trendBars = [
    { height: '40%', isAccent: false },
    { height: '55%', isAccent: false },
    { height: '90%', isAccent: true },
    { height: '45%', isAccent: false },
    { height: '60%', isAccent: false },
    { height: '75%', isAccent: false },
    { height: '30%', isAccent: false },
    { height: '100%', isAccent: true },
    { height: '65%', isAccent: false },
    { height: '50%', isAccent: false },
    { height: '80%', isAccent: false },
    { height: '45%', isAccent: true }
  ];

  return (
    <div className="space-y-5 pb-12">
      {/* Bento Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Security Operations Center
          </h1>
          <p className="text-xs text-slate-500 dark:text-[#666] mt-0.5">
            Tenant:{' '}
            <span className="text-[#F27D26] font-semibold">
              {selectedOrgId === 'all'
                ? 'PNGee IT Solutions (Global Managed SOC Operations)'
                : currentOrg?.name || 'Assigned Organization'}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-white dark:bg-[#111114] rounded-lg border border-slate-200 dark:border-[#1F1F23] items-center px-3 py-1.5 gap-2 shadow-xs">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-[10px] uppercase font-bold text-slate-600 dark:text-[#888] tracking-wider">
              System Healthy
            </span>
          </div>

          <button
            onClick={() => setShowPostureBreakdown(true)}
            className="bg-white dark:bg-[#1A1A1D] hover:bg-slate-50 dark:hover:bg-[#252529] rounded-lg px-3 py-1.5 border border-slate-200 dark:border-[#333] text-xs font-semibold flex items-center gap-2 text-slate-700 dark:text-[#AAA] transition-colors"
          >
            <Info className="w-3.5 h-3.5 text-[#F27D26]" />
            <span>Score Details</span>
          </button>
        </div>
      </header>

      {/* Main Bento Grid Structure (12 Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Bento Cell 1: Security Posture (3 Cols) */}
        <div className="lg:col-span-3 bg-white dark:bg-[#111114] border border-slate-200 dark:border-[#1F1F23] rounded-xl p-5 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] uppercase text-slate-500 dark:text-[#666] font-bold tracking-widest">
                Security Posture
              </h3>
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded font-mono border ${getGradeColor(
                  posture?.grade
                )}`}
              >
                {posture?.grade || 'A'}
              </span>
            </div>

            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-5xl font-light text-slate-900 dark:text-white leading-none font-mono">
                {posture?.overallScore ?? 87}
              </span>
              <span className="text-slate-400 dark:text-[#666] font-medium text-base">/100</span>
            </div>

            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-2 font-semibold flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              <span>+4.2% from last baseline cycle</span>
            </p>
          </div>

          <div className="space-y-1.5 mt-6 pt-4 border-t border-slate-100 dark:border-[#1F1F23]">
            <div className="h-1.5 w-full bg-slate-100 dark:bg-[#222] rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-700 rounded-full"
                style={{ width: `${posture?.overallScore || 87}%` }}
              ></div>
            </div>
            <div className="flex items-center justify-between text-[9px] text-slate-400 dark:text-[#555]">
              <span>Current: {posture?.overallScore || 87}.0</span>
              <span>Target: 95.0</span>
            </div>
          </div>
        </div>

        {/* Bento Cell 2: Event Correlation Trend (6 Cols) */}
        <div className="lg:col-span-6 bg-white dark:bg-[#111114] border border-slate-200 dark:border-[#1F1F23] rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-[10px] uppercase text-slate-500 dark:text-[#666] font-bold tracking-widest">
              Event Correlation Trend
            </h3>
            <div className="flex gap-3 text-[10px] font-semibold">
              <button
                onClick={() => setTrendFilter('all')}
                className={`transition-colors ${
                  trendFilter === 'all' ? 'text-[#F27D26] font-bold' : 'text-slate-400 dark:text-[#666] hover:text-slate-200'
                }`}
              >
                All Telemetry
              </button>
              <button
                onClick={() => setTrendFilter('auth')}
                className={`transition-colors ${
                  trendFilter === 'auth' ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-400 dark:text-[#666] hover:text-slate-200'
                }`}
              >
                Auth
              </button>
              <button
                onClick={() => setTrendFilter('malware')}
                className={`transition-colors ${
                  trendFilter === 'malware' ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-400 dark:text-[#666] hover:text-slate-200'
                }`}
              >
                Malware
              </button>
              <button
                onClick={() => setTrendFilter('identity')}
                className={`transition-colors ${
                  trendFilter === 'identity' ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-400 dark:text-[#666] hover:text-slate-200'
                }`}
              >
                Identity
              </button>
            </div>
          </div>

          <div className="flex items-end gap-1.5 h-24 my-2">
            {trendBars.map((bar, idx) => (
              <div
                key={idx}
                className={`flex-1 rounded-t transition-all ${
                  bar.isAccent
                    ? 'bg-[#F27D26] hover:opacity-100 opacity-90'
                    : 'bg-slate-200 dark:bg-[#1A1A1D] hover:bg-slate-300 dark:hover:bg-[#252529]'
                }`}
                style={{ height: bar.height }}
                title={`Interval ${idx + 1}: Rate nominal`}
              ></div>
            ))}
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-[#666] pt-2 border-t border-slate-100 dark:border-[#1F1F23]">
            <span>Peak: 1,420 events/sec</span>
            <span>Live Normalized Stream: Active</span>
          </div>
        </div>

        {/* Bento Cell 3: Active Incidents (3 Cols) */}
        <div className="lg:col-span-3 bg-white dark:bg-[#111114] border border-slate-200 dark:border-[#1F1F23] rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-[10px] uppercase text-slate-500 dark:text-[#666] font-bold tracking-widest mb-4">
              Active Incidents
            </h3>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-700 dark:text-slate-300">Critical (P1)</span>
                <span className="text-xs font-bold text-red-500 font-mono">
                  {criticalIncidentsCount.toString().padStart(2, '0')}
                </span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-500 dark:text-[#888]">High (P2)</span>
                <span className="text-xs font-bold text-slate-800 dark:text-white font-mono">
                  {highIncidentsCount.toString().padStart(2, '0')}
                </span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-500 dark:text-[#888]">In Investigation</span>
                <span className="text-xs font-bold text-slate-800 dark:text-white font-mono">
                  {investigatingIncidentsCount.toString().padStart(2, '0')}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-[#1F1F23]">
            <button
              onClick={() => setActiveView('incidents')}
              className="w-full py-2 bg-[#F27D26] hover:bg-[#e06c17] text-black text-[10px] font-bold uppercase rounded-lg tracking-wider transition-colors"
            >
              View IR Console
            </button>
          </div>
        </div>

        {/* Bento Cell 4: Critical Alert Queue (8 Cols) */}
        <div className="lg:col-span-8 bg-white dark:bg-[#111114] border border-slate-200 dark:border-[#1F1F23] rounded-xl p-5 shadow-xs overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] uppercase text-slate-500 dark:text-[#666] font-bold tracking-widest">
                Critical Alert Queue ({alerts.length})
              </h3>
              <button
                onClick={() => setActiveView('alerts')}
                className="text-[10px] font-bold uppercase text-[#F27D26] hover:underline"
              >
                View All Queue
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-slate-400 dark:text-[#555] font-bold text-[10px] uppercase tracking-wider">
                  <tr className="border-b border-slate-100 dark:border-[#1F1F23]">
                    <th className="pb-3">Severity</th>
                    <th className="pb-3">Detection Rule</th>
                    <th className="pb-3">Source Asset</th>
                    <th className="pb-3">Timestamp</th>
                    <th className="pb-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="text-slate-600 dark:text-[#AAA] divide-y divide-slate-100 dark:divide-[#1F1F23]">
                  {alerts.slice(0, 5).map(alert => (
                    <tr key={alert.id} className="hover:bg-slate-50/60 dark:hover:bg-[#151518] transition-colors">
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${getSeverityBadge(alert.severity)}`}>
                          {alert.severity}
                        </span>
                      </td>
                      <td className="py-3 font-medium text-slate-900 dark:text-white max-w-xs truncate">
                        {alert.title}
                      </td>
                      <td className="py-3 font-mono text-slate-500 dark:text-[#888] text-[11px]">
                        {alert.assetHostname || 'Cloud-Workload'}
                      </td>
                      <td className="py-3 font-mono text-slate-400 dark:text-[#666] text-[11px]">
                        {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => handleSummarizeAlert(alert)}
                          disabled={summarizingAlertId === alert.id}
                          className="text-[#F27D26] font-semibold text-xs hover:underline"
                        >
                          {summarizingAlertId === alert.id ? 'Analyzing...' : 'Triage'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* AI SOC Briefing if active */}
          {alertAiSummary && (
            <div className="mt-3 p-3 rounded-lg bg-[#1A1A1D] border border-[#333] text-xs text-[#AAA] whitespace-pre-line leading-relaxed">
              <div className="flex items-center justify-between mb-1 font-bold text-[#F27D26]">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> SOC Copilot Briefing
                </span>
                <button
                  onClick={() => setAlertAiSummary(null)}
                  className="text-[#666] hover:text-[#AAA] text-xs"
                >
                  ✕
                </button>
              </div>
              {alertAiSummary.text}
            </div>
          )}
        </div>

        {/* Bento Cell 5: Asset Health Matrix (4 Cols) */}
        <div className="lg:col-span-4 bg-white dark:bg-[#111114] border border-slate-200 dark:border-[#1F1F23] rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <h3 className="text-[10px] uppercase text-slate-500 dark:text-[#666] font-bold tracking-widest mb-4">
            Asset Health Matrix
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div
              onClick={() => setActiveView('assets')}
              className="bg-slate-50 dark:bg-[#0A0A0B] p-3 rounded-lg border border-slate-200 dark:border-[#1F1F23] cursor-pointer hover:border-slate-300 dark:hover:border-[#333] transition-colors"
            >
              <div className="text-2xl font-light text-slate-900 dark:text-white font-mono">
                {onlineAssets} <span className="text-xs text-slate-400 font-sans">/ {totalAssets}</span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-[#666] font-bold mt-1">
                Managed Endpoints
              </p>
            </div>

            <div
              onClick={() => setActiveView('vulnerabilities')}
              className="bg-slate-50 dark:bg-[#0A0A0B] p-3 rounded-lg border border-slate-200 dark:border-[#1F1F23] cursor-pointer hover:border-slate-300 dark:hover:border-[#333] transition-colors"
            >
              <div className="text-2xl font-light text-red-500 font-mono">
                {missingPatchesCount}
              </div>
              <p className="text-[10px] text-slate-500 dark:text-[#666] font-bold mt-1">
                Missing Patches / CVEs
              </p>
            </div>

            <div
              onClick={() => setActiveView('assets')}
              className="bg-slate-50 dark:bg-[#0A0A0B] p-3 rounded-lg border border-slate-200 dark:border-[#1F1F23] cursor-pointer hover:border-slate-300 dark:hover:border-[#333] transition-colors"
            >
              <div className="text-2xl font-light text-slate-900 dark:text-white font-mono">
                {assets.filter(a => a.type === 'FIREWALL' || a.type === 'ROUTER').length || 8}
              </div>
              <p className="text-[10px] text-slate-500 dark:text-[#666] font-bold mt-1">
                Network Devices
              </p>
            </div>

            <div
              onClick={() => setActiveView('specialized')}
              className="bg-slate-50 dark:bg-[#0A0A0B] p-3 rounded-lg border border-slate-200 dark:border-[#1F1F23] cursor-pointer hover:border-slate-300 dark:hover:border-[#333] transition-colors"
            >
              <div className="text-2xl font-light text-emerald-500 font-mono">
                {backupCoveragePct}%
              </div>
              <p className="text-[10px] text-slate-500 dark:text-[#666] font-bold mt-1">
                Backup Coverage
              </p>
            </div>
          </div>
        </div>

        {/* Bento Cell 6: Normalized Live Telemetry Stream (8 Cols) */}
        <div className="lg:col-span-8 bg-white dark:bg-[#111114] border border-slate-200 dark:border-[#1F1F23] rounded-xl p-5 shadow-xs overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] uppercase text-slate-500 dark:text-[#666] font-bold tracking-widest">
              Live Normalized Telemetry Stream
            </h3>
            <button
              onClick={() => setActiveView('monitoring')}
              className="text-[10px] font-bold uppercase text-[#F27D26] hover:underline"
            >
              Open Inspector
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-400 dark:text-[#555] font-bold text-[10px] uppercase tracking-wider">
                <tr className="border-b border-slate-100 dark:border-[#1F1F23]">
                  <th className="pb-3">Timestamp</th>
                  <th className="pb-3">Severity</th>
                  <th className="pb-3">Source & Type</th>
                  <th className="pb-3">Event Description</th>
                  <th className="pb-3">Host / User</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1F1F23] font-mono">
                {events.slice(0, 5).map(evt => (
                  <tr key={evt.id} className="hover:bg-slate-50/60 dark:hover:bg-[#151518] transition-colors">
                    <td className="py-2.5 text-slate-400 dark:text-[#666] whitespace-nowrap text-[11px]">
                      {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="py-2.5 whitespace-nowrap">
                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${getSeverityBadge(evt.severity)}`}>
                        {evt.severity}
                      </span>
                    </td>
                    <td className="py-2.5 text-slate-700 dark:text-[#AAA] font-sans whitespace-nowrap text-xs">
                      <div className="font-semibold">{evt.source}</div>
                    </td>
                    <td className="py-2.5 text-slate-800 dark:text-[#CCC] font-sans max-w-xs truncate text-xs">
                      {evt.eventDescription}
                    </td>
                    <td className="py-2.5 text-slate-500 dark:text-[#888] text-[11px] whitespace-nowrap">
                      <div>{evt.host || 'SRV-PRIMARY'}</div>
                    </td>
                    <td className="py-2.5 whitespace-nowrap">
                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                        evt.status === 'CORRELATED' 
                          ? 'bg-red-500/10 text-red-500 border border-red-500/20' 
                          : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                      }`}>
                        {evt.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bento Cell 7: Real-Time Monitoring & Threat Feed (4 Cols) */}
        <div className="lg:col-span-4 bg-white dark:bg-[#111114] border border-slate-200 dark:border-[#1F1F23] rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <h3 className="text-[10px] uppercase text-slate-500 dark:text-[#666] font-bold tracking-widest">
            Monitoring Feed
          </h3>
          <div className="space-y-3.5 mt-4">
            <div className="flex gap-3 text-[10px]">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1 shrink-0"></div>
              <div>
                <p className="text-slate-600 dark:text-[#AAA]">
                  <span className="font-semibold text-slate-900 dark:text-white">Agent Enrollment:</span> WKST-NEW-091 successfully registered.
                </p>
                <p className="text-slate-400 dark:text-[#444] font-mono mt-0.5">2 minutes ago</p>
              </div>
            </div>

            <div className="flex gap-3 text-[10px]">
              <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 mt-1 shrink-0"></div>
              <div>
                <p className="text-slate-600 dark:text-[#AAA]">
                  <span className="font-semibold text-slate-900 dark:text-white">SSL Expiry:</span> domain.com cert expires in 3 days.
                </p>
                <p className="text-slate-400 dark:text-[#444] font-mono mt-0.5">14 minutes ago</p>
              </div>
            </div>

            <div className="flex gap-3 text-[10px] text-red-500">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1 shrink-0 animate-pulse"></div>
              <div>
                <p className="text-red-600 dark:text-red-400">
                  <span className="font-bold">System Alert:</span> MITRE T1110 SSH Brute-force blocked on SRV-PROD-SQL01.
                </p>
                <p className="text-slate-400 dark:text-[#444] font-mono mt-0.5">Just now</p>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-[#1F1F23] flex justify-between items-center text-[10px] text-slate-400 dark:text-[#666]">
            <span>Feed Protocol: Websocket (Active)</span>
            <span className="text-[#F27D26] font-mono">LIVE</span>
          </div>
        </div>
      </div>

      {/* Security Posture Breakdown Drawer / Modal */}
      {showPostureBreakdown && posture && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-[#111114] border border-slate-200 dark:border-[#1F1F23] rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-[#1F1F23] flex items-center justify-between bg-slate-50 dark:bg-[#0A0A0B]">
              <div className="flex items-center gap-3">
                <div className={`text-2xl font-black px-3 py-1 rounded-lg border font-mono ${getGradeColor(posture.grade)}`}>
                  {posture.grade}
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    Cybersecurity Posture Score Methodology & Factor Breakdown
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-[#666]">
                    Calculated Overall Score: <strong className="text-[#F27D26]">{posture.overallScore} / 100</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPostureBreakdown(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="text-xs text-slate-600 dark:text-[#AAA] leading-relaxed bg-[#F27D26]/5 p-3 rounded-lg border border-[#F27D26]/20">
                PNGee CyberGuard evaluates customer defensive posture across 6 weighted cybersecurity categories. Every deduction reflects real telemetry breaches, unpatched CVEs, failing backups, or MFA gaps.
              </div>

              <div className="space-y-3">
                {posture.factors.map((factor, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border border-slate-200 dark:border-[#1F1F23] bg-slate-50 dark:bg-[#0A0A0B] space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-slate-900 dark:text-white text-xs">
                        {factor.category}{' '}
                        <span className="text-slate-400 dark:text-[#666] font-normal font-mono">
                          (Weight: {Math.round(factor.weight * 100)}%)
                        </span>
                      </div>
                      <span className={`font-mono font-bold px-2 py-0.5 rounded text-xs ${
                        factor.score >= 85 ? 'text-emerald-500 bg-emerald-500/10' : factor.score >= 65 ? 'text-amber-500 bg-amber-500/10' : 'text-red-500 bg-red-500/10'
                      }`}>
                        Score: {factor.score} / 100
                      </span>
                    </div>

                    {factor.deductions.length > 0 && (
                      <div className="space-y-1 pt-1">
                        <div className="font-semibold text-red-500 text-[11px]">Deductions:</div>
                        {factor.deductions.map((d, dIdx) => (
                          <div key={dIdx} className="text-slate-600 dark:text-[#AAA] flex items-start gap-1.5 text-[11px]">
                            <TrendingDown className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                            <span>{d}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {factor.positivePoints.length > 0 && (
                      <div className="space-y-1 pt-1">
                        <div className="font-semibold text-emerald-500 text-[11px]">Strengths:</div>
                        {factor.positivePoints.map((p, pIdx) => (
                          <div key={pIdx} className="text-slate-600 dark:text-[#AAA] flex items-start gap-1.5 text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                            <span>{p}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {factor.remediationAdvice.length > 0 && (
                      <div className="space-y-1 pt-1 bg-amber-500/5 p-2 rounded border border-amber-500/20">
                        <div className="font-semibold text-amber-500 text-[11px]">Recommended Remediation:</div>
                        {factor.remediationAdvice.map((a, aIdx) => (
                          <div key={aIdx} className="text-slate-700 dark:text-[#BBB] text-[11px]">
                            • {a}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-3 border-t border-slate-200 dark:border-[#1F1F23] flex justify-end bg-slate-50 dark:bg-[#0A0A0B]">
              <button
                onClick={() => setShowPostureBreakdown(false)}
                className="px-4 py-2 rounded-lg bg-[#F27D26] text-black text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-opacity"
              >
                Close Breakdown
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
