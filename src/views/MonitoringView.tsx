import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { SecurityEvent, DetectionRule } from '../types';
import {
  Activity,
  Search,
  Filter,
  Shield,
  Zap,
  Sliders,
  CheckCircle2,
  XCircle,
  ToggleLeft,
  ToggleRight,
  Plus,
  RefreshCw,
  Terminal,
  ExternalLink
} from 'lucide-react';

interface MonitoringViewProps {
  onOpenSimulator: () => void;
}

export const MonitoringView: React.FC<MonitoringViewProps> = ({ onOpenSimulator }) => {
  const { isSuperAdmin } = useAuth();
  const { selectedOrgId, refreshTrigger, addToast } = useApp();

  const [activeTab, setActiveTab] = useState<'TELEMETRY' | 'RULES'>('TELEMETRY');
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [rules, setRules] = useState<DetectionRule[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // New Rule Modal
  const [showNewRuleModal, setShowNewRuleModal] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [ruleDesc, setRuleDesc] = useState('');
  const [ruleSeverity, setRuleSeverity] = useState<DetectionRule['severity']>('HIGH');
  const [ruleCategory, setRuleCategory] = useState('Malware');
  const [ruleThreshold, setRuleThreshold] = useState(3);
  const [ruleWindow, setRuleWindow] = useState(5);
  const [ruleMitre, setRuleMitre] = useState('T1059 (Command Execution)');

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [eData, rData] = await Promise.all([
        api.getEvents({ category: categoryFilter, severity: severityFilter, limit: 100 }),
        api.getDetectionRules()
      ]);
      setEvents(eData);
      setRules(rData);
    } catch (err) {
      console.error('Failed to load telemetry:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedOrgId, categoryFilter, severityFilter, refreshTrigger]);

  const handleToggleRule = async (ruleId: string) => {
    try {
      const updated = await api.toggleDetectionRule(ruleId);
      setRules(prev => prev.map(r => r.id === ruleId ? updated : r));
      addToast('Detection Rule Updated', `Rule "${updated.name}" is now ${updated.enabled ? 'ENABLED' : 'DISABLED'}.`, 'info');
    } catch (err: any) {
      addToast('Update Failed', err.message, 'error');
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await api.createDetectionRule({
        name: ruleName,
        description: ruleDesc,
        severity: ruleSeverity,
        category: ruleCategory,
        threshold: ruleThreshold,
        timeWindowMinutes: ruleWindow,
        mitreTechnique: ruleMitre
      });
      addToast('Rule Created', `Detection rule "${created.name}" created.`, 'success');
      setShowNewRuleModal(false);
      setRuleName('');
      setRuleDesc('');
      loadData();
    } catch (err: any) {
      addToast('Failed to create rule', err.message, 'error');
    }
  };

  const filteredEvents = events.filter(e => {
    const q = (searchQuery || '').toLowerCase().trim();
    return !q ||
      (e.eventDescription && e.eventDescription.toLowerCase().includes(q)) ||
      (e.source && e.source.toLowerCase().includes(q)) ||
      (e.sourceIP && e.sourceIP.toLowerCase().includes(q)) ||
      (e.destinationIP && e.destinationIP.toLowerCase().includes(q)) ||
      (e.username && e.username.toLowerCase().includes(q)) ||
      (e.host && e.host.toLowerCase().includes(q)) ||
      (e.mitreTechnique && e.mitreTechnique.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Security Telemetry & Detection Engine
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Normalized multi-source telemetry ingestion, SIEM correlation, and MITRE ATT&CK detection rules
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpenSimulator}
            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Simulate Attack Telemetry</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-slate-200 dark:border-[#1F1F23] text-xs font-semibold gap-6">
        <button
          onClick={() => setActiveTab('TELEMETRY')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'TELEMETRY'
              ? 'border-[#F27D26] text-slate-900 dark:text-white font-bold'
              : 'border-transparent text-slate-500 dark:text-[#666] hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Activity className={`w-4 h-4 ${activeTab === 'TELEMETRY' ? 'text-[#F27D26]' : ''}`} />
          <span>Telemetry Event Log ({filteredEvents.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('RULES')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'RULES'
              ? 'border-[#F27D26] text-slate-900 dark:text-white font-bold'
              : 'border-transparent text-slate-500 dark:text-[#666] hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Sliders className={`w-4 h-4 ${activeTab === 'RULES' ? 'text-[#F27D26]' : ''}`} />
          <span>Correlation & Detection Rules ({rules.length})</span>
        </button>
      </div>

      {/* TAB 1: TELEMETRY STREAM */}
      {activeTab === 'TELEMETRY' && (
        <div className="space-y-4">
          {/* Filters & Search */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#111114] p-3 rounded-xl border border-slate-200 dark:border-[#1F1F23] shadow-xs">
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 dark:text-[#666] ml-1" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search telemetry by message, IP address, host, MITRE tag..."
                className="bg-transparent text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#666] focus:outline-none w-full"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="text-xs bg-slate-100 dark:bg-[#1A1A1D] border border-slate-300 dark:border-[#333] rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-[#AAA]"
              >
                <option value="">All Severities</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="text-xs bg-slate-100 dark:bg-[#1A1A1D] border border-slate-300 dark:border-[#333] rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-[#AAA]"
              >
                <option value="">All Categories</option>
                <option value="Authentication">Authentication</option>
                <option value="Malware">Malware</option>
                <option value="Network">Network</option>
                <option value="Privilege Escalation">Privilege Escalation</option>
                <option value="Identity">Identity</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-[#111114] rounded-xl border border-slate-200 dark:border-[#1F1F23] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-50 dark:bg-[#0A0A0B] text-slate-500 dark:text-[#666] font-bold border-b border-slate-200 dark:border-[#1F1F23] font-sans text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Severity</th>
                    <th className="px-4 py-3">Source & Category</th>
                    <th className="px-4 py-3">Host / User</th>
                    <th className="px-4 py-3">Normalized Telemetry Description</th>
                    <th className="px-4 py-3">MITRE ATT&CK</th>
                    <th className="px-4 py-3">Correlation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#1F1F23]">
                  {filteredEvents.map(evt => (
                    <tr key={evt.id} className="hover:bg-slate-50/60 dark:hover:bg-[#151518] transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-slate-500 dark:text-[#666] text-[11px]">
                        {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          evt.severity === 'CRITICAL' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                          evt.severity === 'HIGH' ? 'bg-orange-500/10 text-orange-500 border border-orange-500/20' :
                          evt.severity === 'MEDIUM' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                        }`}>
                          {evt.severity}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-sans">
                        <div className="font-semibold text-slate-800 dark:text-slate-200 text-xs">{evt.source}</div>
                        <div className="text-[10px] text-slate-400 dark:text-[#666]">{evt.eventCategory}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-[11px] text-slate-600 dark:text-[#AAA]">
                        <div>{evt.host || 'N/A'}</div>
                        <div className="text-[10px] text-slate-400 dark:text-[#666]">{evt.username || evt.sourceIP || ''}</div>
                      </td>
                      <td className="px-4 py-3 font-sans text-slate-800 dark:text-[#CCC] max-w-md">
                        <div className="truncate font-medium">{evt.eventDescription}</div>
                        <div className="text-[10px] text-slate-400 dark:text-[#666] font-mono truncate">{evt.rawEventReference}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {evt.mitreTechnique ? (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            {evt.mitreTechnique}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-[#555] text-[10px]">--</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-sans">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
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
        </div>
      )}

      {/* TAB 2: DETECTION RULES MANAGER */}
      {activeTab === 'RULES' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white dark:bg-[#111114] p-4 rounded-xl border border-slate-200 dark:border-[#1F1F23] shadow-xs">
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">Active Detection & Correlation Rules</h3>
              <p className="text-[11px] text-slate-500 dark:text-[#666]">Rules continuously monitor normalized telemetry streams to trigger automated alerts</p>
            </div>
            {isSuperAdmin && (
              <button
                onClick={() => setShowNewRuleModal(true)}
                className="px-3 py-1.5 bg-[#F27D26] hover:bg-[#e06c17] text-black rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Detection Rule</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rules.map(rule => (
              <div
                key={rule.id}
                className={`p-4 rounded-xl border transition-all space-y-3 ${
                  rule.enabled
                    ? 'bg-white dark:bg-[#111114] border-slate-200 dark:border-[#1F1F23]'
                    : 'bg-slate-50 dark:bg-[#0A0A0B]/60 border-slate-200 dark:border-[#1F1F23] opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${
                      rule.severity === 'CRITICAL' ? 'bg-rose-500/10 text-rose-500' :
                      rule.severity === 'HIGH' ? 'bg-orange-500/10 text-orange-500' : 'bg-amber-500/10 text-amber-500'
                    }`}>
                      {rule.severity}
                    </span>
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white">{rule.name}</h4>
                  </div>
                  {isSuperAdmin && (
                    <button
                      onClick={() => handleToggleRule(rule.id)}
                      className="text-slate-400 hover:text-blue-500 transition-colors"
                      title={rule.enabled ? 'Disable rule' : 'Enable rule'}
                    >
                      {rule.enabled ? <ToggleRight className="w-6 h-6 text-blue-500" /> : <ToggleLeft className="w-6 h-6 text-slate-400" />}
                    </button>
                  )}
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {rule.description}
                </p>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between text-[11px] text-slate-500 gap-2">
                  <span>Threshold: <strong className="text-slate-800 dark:text-slate-200 font-mono">{rule.threshold} events / {rule.timeWindowMinutes} min</strong></span>
                  <span>Scope: <strong className="text-slate-800 dark:text-slate-200 font-mono">{rule.organizationScope}</strong></span>
                  <span className="text-indigo-400 font-mono">{rule.mitreTechnique}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New Rule Modal */}
      {showNewRuleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Create Detection Rule</h2>
            <form onSubmit={handleCreateRule} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">Rule Name</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Kerberoasting Ticket Request Spike"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">Description</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Explain the security condition..."
                  value={ruleDesc}
                  onChange={(e) => setRuleDesc(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Severity</label>
                  <select
                    value={ruleSeverity}
                    onChange={(e) => setRuleSeverity(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2"
                  >
                    <option value="CRITICAL">Critical</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold block mb-1">Category</label>
                  <input
                    type="text"
                    value={ruleCategory}
                    onChange={(e) => setRuleCategory(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Threshold Events</label>
                  <input
                    type="number"
                    value={ruleThreshold}
                    onChange={(e) => setRuleThreshold(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Time Window (Minutes)</label>
                  <input
                    type="number"
                    value={ruleWindow}
                    onChange={(e) => setRuleWindow(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2"
                  />
                </div>
              </div>
              <div>
                <label className="font-semibold block mb-1">MITRE ATT&CK Technique</label>
                <input
                  type="text"
                  value={ruleMitre}
                  onChange={(e) => setRuleMitre(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-mono"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewRuleModal(false)}
                  className="px-4 py-2 rounded-lg text-slate-500 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold"
                >
                  Save Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
