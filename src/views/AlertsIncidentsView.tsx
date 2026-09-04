import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { SecurityAlert, SecurityIncident, SecurityIncidentStatus, Asset } from '../types';
import {
  Flame,
  ShieldAlert,
  Search,
  Filter,
  Plus,
  Sparkles,
  CheckCircle2,
  Clock,
  ChevronRight,
  User,
  Activity,
  FileText,
  AlertTriangle,
  ArrowRight,
  Shield,
  Layers,
  Lock,
  RefreshCw,
  Send
} from 'lucide-react';

export const AlertsIncidentsView: React.FC = () => {
  const { currentUser, isSuperAdmin, isSecAnalyst, isCustomerAdmin } = useAuth();
  const { selectedOrgId, refreshTrigger, addToast } = useApp();

  const [activeTab, setActiveTab] = useState<'INCIDENTS' | 'ALERTS'>('INCIDENTS');
  const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<SecurityIncident | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<SecurityAlert | null>(null);

  // Modals & Action States
  const [showDeclareModal, setShowDeclareModal] = useState(false);
  const [newIncTitle, setNewIncTitle] = useState('');
  const [newIncDesc, setNewIncDesc] = useState('');
  const [newIncSeverity, setNewIncSeverity] = useState<SecurityIncident['severity']>('HIGH');
  const [newIncAssetId, setNewIncAssetId] = useState('');

  // Timeline entry state
  const [timelineNote, setTimelineNote] = useState('');
  const [timelineAction, setTimelineAction] = useState('Analyst Note');

  // AI Summary State
  const [aiIncidentSummary, setAiIncidentSummary] = useState<string | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  const loadData = async () => {
    try {
      const [iData, aData, astData] = await Promise.all([
        api.getIncidents(),
        api.getAlerts(),
        api.getAssets()
      ]);
      setIncidents(iData);
      setAlerts(aData);
      setAssets(astData);

      if (iData.length > 0 && !selectedIncident) {
        setSelectedIncident(iData[0]);
      }
      if (aData.length > 0 && !selectedAlert) {
        setSelectedAlert(aData[0]);
      }
    } catch (err) {
      console.error('Failed to load alerts and incidents:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedOrgId, refreshTrigger]);

  const handleStageTransition = async (incident: SecurityIncident, newStatus: SecurityIncidentStatus) => {
    try {
      const updated = await api.updateIncident(incident.id, {
        status: newStatus,
        actionDescription: `Incident stage transitioned to ${newStatus} by ${currentUser?.name}.`
      });

      setIncidents(prev => prev.map(i => i.id === incident.id ? updated : i));
      setSelectedIncident(updated);
      addToast('Incident Updated', `Incident status changed to [${newStatus}].`, 'success');
    } catch (err: any) {
      addToast('Update Failed', err.message, 'error');
    }
  };

  const handleAddTimelineNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncident || !timelineNote.trim()) return;

    try {
      const updatedTimeline = [
        ...selectedIncident.timeline,
        {
          id: `tl-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actor: currentUser?.name || 'SOC Analyst',
          action: timelineAction,
          description: timelineNote,
          type: 'NOTE' as const
        }
      ];

      const updated = await api.updateIncident(selectedIncident.id, {
        timeline: updatedTimeline
      });

      setIncidents(prev => prev.map(i => i.id === selectedIncident.id ? updated : i));
      setSelectedIncident(updated);
      setTimelineNote('');
      addToast('Note Added', 'Incident activity timeline updated.', 'info');
    } catch (err: any) {
      addToast('Failed to add note', err.message, 'error');
    }
  };

  const handleDeclareIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newInc = await api.createIncident({
        title: newIncTitle,
        description: newIncDesc,
        severity: newIncSeverity,
        affectedAssetIds: newIncAssetId ? [newIncAssetId] : []
      });

      addToast('Incident Declared', `Incident "${newInc.title}" registered in command queue.`, 'success');
      setShowDeclareModal(false);
      setNewIncTitle('');
      setNewIncDesc('');
      loadData();
    } catch (err: any) {
      addToast('Creation Failed', err.message, 'error');
    }
  };

  const handleUpdateAlertStatus = async (alertId: string, status: string) => {
    try {
      const updated = await api.updateAlertStatus(alertId, status);
      setAlerts(prev => prev.map(a => a.id === alertId ? updated : a));
      if (selectedAlert?.id === alertId) setSelectedAlert(updated);
      addToast('Alert Updated', `Alert marked as ${status}.`, 'info');
    } catch (err: any) {
      addToast('Failed to update alert', err.message, 'error');
    }
  };

  const handleGenerateAiIncidentBrief = async () => {
    if (!selectedIncident) return;
    setIsLoadingAi(true);
    try {
      const res = await api.generateIncidentSummary(selectedIncident.id);
      setAiIncidentSummary(res.summary);
    } catch (err: any) {
      addToast('AI Briefing Failed', err.message, 'error');
    } finally {
      setIsLoadingAi(false);
    }
  };

  const stages: SecurityIncidentStatus[] = [
    'DETECTED',
    'TRIAGE',
    'INVESTIGATING',
    'CONTAINMENT',
    'ERADICATION',
    'RECOVERY',
    'CLOSED'
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Alert Triage & Incident Command
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            End-to-end 7-stage incident response workspace, forensic evidence timeline, and containment playbooks
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {(isSuperAdmin || isSecAnalyst || isCustomerAdmin) && (
            <button
              onClick={() => setShowDeclareModal(true)}
              className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm shadow-rose-500/20 transition-all"
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Declare Security Incident</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-slate-200 dark:border-slate-800 text-xs font-semibold gap-6">
        <button
          onClick={() => setActiveTab('INCIDENTS')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'INCIDENTS'
              ? 'border-rose-500 text-rose-600 dark:text-rose-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Flame className="w-4 h-4" />
          <span>Incident Command ({incidents.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('ALERTS')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'ALERTS'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Alert Triage Queue ({alerts.length})</span>
        </button>
      </div>

      {/* TAB 1: INCIDENTS COMMAND */}
      {activeTab === 'INCIDENTS' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Incident Roster (4 cols) */}
          <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col">
            <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 font-semibold text-xs text-slate-700 dark:text-slate-300">
              Active Incidents Roster
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 overflow-y-auto max-h-[620px]">
              {incidents.map(inc => {
                const isSelected = selectedIncident?.id === inc.id;
                return (
                  <div
                    key={inc.id}
                    onClick={() => {
                      setSelectedIncident(inc);
                      setAiIncidentSummary(null);
                    }}
                    className={`p-4 cursor-pointer transition-all space-y-2 ${
                      isSelected
                        ? 'bg-rose-500/10 dark:bg-rose-500/15 border-l-4 border-l-rose-500'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${
                        inc.severity === 'CRITICAL' ? 'bg-rose-500/10 text-rose-500' : 'bg-orange-500/10 text-orange-500'
                      }`}>
                        {inc.severity}
                      </span>
                      <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {inc.status}
                      </span>
                    </div>

                    <h4 className="font-bold text-xs text-slate-900 dark:text-white line-clamp-1">
                      {inc.title}
                    </h4>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                      {inc.description}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-200/50 dark:border-slate-800">
                      <span>Analyst: <strong className="text-slate-600 dark:text-slate-300">{inc.assignedAnalystName}</strong></span>
                      <span>{new Date(inc.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Incident Details & 7-Stage Command Workspace (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            {selectedIncident ? (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-6">
                {/* Top Title & AI Button */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/10 text-rose-500 font-mono">
                        {selectedIncident.id}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 font-mono">
                        {selectedIncident.severity}
                      </span>
                    </div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      {selectedIncident.title}
                    </h2>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      {selectedIncident.description}
                    </p>
                  </div>
                  <button
                    onClick={handleGenerateAiIncidentBrief}
                    disabled={isLoadingAi}
                    className="shrink-0 px-3.5 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                  >
                    {isLoadingAi ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-cyan-200" />}
                    <span>AI Incident Briefing</span>
                  </button>
                </div>

                {/* AI Executive Summary Block if generated */}
                {aiIncidentSummary && (
                  <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-xs text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed space-y-2">
                    <div className="flex items-center justify-between font-bold text-indigo-600 dark:text-indigo-400">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4" /> AI SOC Incident Brief & Playbook
                      </span>
                      <button onClick={() => setAiIncidentSummary(null)} className="text-slate-400 hover:text-slate-600">✕</button>
                    </div>
                    <div>{aiIncidentSummary}</div>
                  </div>
                )}

                {/* 7-Stage Incident State Machine Progression Bar */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Incident Lifecycle Progression (7 Stages):
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1.5">
                    {stages.map((stg, idx) => {
                      const isCurrent = selectedIncident.status === stg;
                      const isPast = stages.indexOf(selectedIncident.status) > idx;
                      return (
                        <button
                          key={stg}
                          onClick={() => handleStageTransition(selectedIncident, stg)}
                          className={`p-2 rounded-lg text-[10px] font-bold text-center transition-all border ${
                            isCurrent
                              ? 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-500/20 ring-2 ring-rose-400'
                              : isPast
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                          }`}
                        >
                          <div>{idx + 1}. {stg}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Affected Systems & Containment Actions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2">
                    <div className="font-bold text-slate-800 dark:text-slate-200">Affected Hostnames:</div>
                    <div className="space-y-1">
                      {selectedIncident.affectedAssetHostnames.map((host, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                          <Activity className="w-3.5 h-3.5 text-rose-500" />
                          <span>{host}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2">
                    <div className="font-bold text-slate-800 dark:text-slate-200">Executed Containment Actions:</div>
                    <div className="space-y-1">
                      {selectedIncident.actionsTaken.map((act, idx) => (
                        <div key={idx} className="flex items-start gap-1.5 text-[11px] text-slate-700 dark:text-slate-300">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{act}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Incident Activity Timeline */}
                <div className="space-y-3 pt-2">
                  <div className="font-bold text-xs text-slate-800 dark:text-slate-200">
                    Forensic Timeline & Audit Records:
                  </div>

                  <div className="space-y-2 max-h-[220px] overflow-y-auto border-l-2 border-slate-200 dark:border-slate-800 pl-4 ml-2">
                    {selectedIncident.timeline.map((entry) => (
                      <div key={entry.id} className="relative text-xs space-y-0.5 pb-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-500 absolute -left-[21px] top-1" />
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-slate-800 dark:text-slate-200">{entry.action}</span>
                          <span className="text-slate-400 font-mono">{new Date(entry.timestamp).toLocaleTimeString()} ({entry.actor})</span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 text-[11px]">{entry.description}</p>
                      </div>
                    ))}
                  </div>

                  {/* Add Note Form */}
                  <form onSubmit={handleAddTimelineNote} className="flex gap-2 pt-2">
                    <input
                      type="text"
                      placeholder="Add analyst note or containment action..."
                      value={timelineNote}
                      onChange={(e) => setTimelineNote(e.target.value)}
                      className="flex-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white"
                    />
                    <button
                      type="submit"
                      disabled={!timelineNote.trim()}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Send className="w-3 h-3" />
                      <span>Log Activity</span>
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              <div className="text-center py-16 text-slate-400 text-xs">
                Select an incident to open the command workspace.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ALERTS TRIAGE */}
      {activeTab === 'ALERTS' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/40">
            <h3 className="font-bold text-xs text-slate-900 dark:text-white">Security Alert Queue</h3>
            <span className="text-xs text-slate-400">{alerts.length} Total Alerts Logged</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Severity</th>
                  <th className="px-4 py-3">Alert Title & Evidence</th>
                  <th className="px-4 py-3">Asset Hostname</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {alerts.map(alert => (
                  <tr key={alert.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                      {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${
                        alert.severity === 'CRITICAL' ? 'bg-rose-500/10 text-rose-500' :
                        alert.severity === 'HIGH' ? 'bg-orange-500/10 text-orange-500' : 'bg-amber-500/10 text-amber-500'
                      }`}>
                        {alert.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-md">
                      <div className="font-bold text-slate-900 dark:text-white">{alert.title}</div>
                      <div className="text-[11px] text-slate-500 truncate">{alert.evidence}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-300">
                      {alert.assetHostname || 'N/A'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase font-mono ${
                        alert.status === 'NEW' ? 'bg-rose-500 text-white animate-pulse' :
                        alert.status === 'INVESTIGATING' ? 'bg-amber-500 text-slate-950' : 'bg-emerald-500/10 text-emerald-500'
                      }`}>
                        {alert.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap space-x-1">
                      {alert.status !== 'RESOLVED' && (
                        <button
                          onClick={() => handleUpdateAlertStatus(alert.id, 'RESOLVED')}
                          className="px-2.5 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 text-[11px] font-semibold"
                        >
                          Resolve
                        </button>
                      )}
                      {alert.status === 'NEW' && (
                        <button
                          onClick={() => handleUpdateAlertStatus(alert.id, 'INVESTIGATING')}
                          className="px-2.5 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 text-[11px] font-semibold"
                        >
                          Investigate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Declare Incident Modal */}
      {showDeclareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Flame className="w-4 h-4 text-rose-500" />
              <span>Declare Security Incident</span>
            </h2>
            <form onSubmit={handleDeclareIncident} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">Incident Title</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Active Ransomware Lateral Movement Detected"
                  value={newIncTitle}
                  onChange={(e) => setNewIncTitle(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">Initial Description</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Summary of threat scope, impacted users, and initial IOCs..."
                  value={newIncDesc}
                  onChange={(e) => setNewIncDesc(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Severity</label>
                  <select
                    value={newIncSeverity}
                    onChange={(e) => setNewIncSeverity(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2"
                  >
                    <option value="CRITICAL">Critical (P1)</option>
                    <option value="HIGH">High (P2)</option>
                    <option value="MEDIUM">Medium (P3)</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold block mb-1">Impacted Asset</label>
                  <select
                    value={newIncAssetId}
                    onChange={(e) => setNewIncAssetId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-mono"
                  >
                    <option value="">Select Asset...</option>
                    {assets.map(a => (
                      <option key={a.id} value={a.id}>{a.hostname} ({a.ipAddress})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeclareModal(false)}
                  className="px-4 py-2 rounded-lg text-slate-500 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold"
                >
                  Declare Incident
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
