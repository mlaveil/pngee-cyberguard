import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { Vulnerability } from '../types';
import {
  Bug,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Clock,
  ArrowUpRight
} from 'lucide-react';

export const VulnerabilitiesView: React.FC = () => {
  const { isSuperAdmin, isSecAnalyst, isCustomerAdmin } = useAuth();
  const { selectedOrgId, refreshTrigger, addToast } = useApp();

  const [vulns, setVulns] = useState<Vulnerability[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedVuln, setSelectedVuln] = useState<Vulnerability | null>(null);

  const loadVulns = async () => {
    try {
      const data = await api.getVulnerabilities();
      setVulns(data);
      if (data.length > 0 && !selectedVuln) {
        setSelectedVuln(data[0]);
      }
    } catch (err) {
      console.error('Failed to load vulnerabilities:', err);
    }
  };

  useEffect(() => {
    loadVulns();
  }, [selectedOrgId, refreshTrigger]);

  const handleUpdateStatus = async (vulnId: string, status: string) => {
    try {
      const updated = await api.updateVulnerability(vulnId, { status });
      setVulns(prev => prev.map(v => v.id === vulnId ? updated : v));
      if (selectedVuln?.id === vulnId) setSelectedVuln(updated);
      addToast('Vulnerability Updated', `Marked CVE as [${status}].`, 'success');
    } catch (err: any) {
      addToast('Update Failed', err.message, 'error');
    }
  };

  const getCvssBadge = (score: number) => {
    if (score >= 9.0) return 'bg-rose-500 text-white font-bold';
    if (score >= 7.0) return 'bg-orange-500 text-white font-bold';
    if (score >= 4.0) return 'bg-amber-500 text-slate-950 font-bold';
    return 'bg-blue-500 text-white';
  };

  const filteredVulns = vulns.filter(v => {
    const q = (searchQuery || '').toLowerCase().trim();
    const matchesSearch = !q ||
      (v.cveId && v.cveId.toLowerCase().includes(q)) ||
      (v.title && v.title.toLowerCase().includes(q)) ||
      (v.software && v.software.toLowerCase().includes(q)) ||
      (v.description && v.description.toLowerCase().includes(q)) ||
      (v.affectedAssetHostname && v.affectedAssetHostname.toLowerCase().includes(q));
    const matchesSev = !severityFilter || v.severity === severityFilter;
    const matchesStat = !statusFilter || v.status === statusFilter;
    return matchesSearch && matchesSev && matchesStat;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
          Vulnerability Management & CVE Tracking
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Continuous patch compliance auditing, CVSS risk scoring, and verified vendor remediation playbooks
        </p>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 ml-1" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by CVE ID, software name, description..."
            className="bg-transparent text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none w-full"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="text-xs bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200"
          >
            <option value="">All Severities</option>
            <option value="CRITICAL">Critical (CVSS 9.0+)</option>
            <option value="HIGH">High (CVSS 7.0-8.9)</option>
            <option value="MEDIUM">Medium (CVSS 4.0-6.9)</option>
            <option value="LOW">Low (CVSS 0.1-3.9)</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200"
          >
            <option value="">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="REMEDIATED">Remediated</option>
          </select>
        </div>
      </div>

      {/* Grid: List + Remediation Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Table (7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">CVE & CVSS</th>
                  <th className="px-4 py-3">Vulnerability Title</th>
                  <th className="px-4 py-3">Affected Software</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredVulns.map(vuln => {
                  const isSelected = selectedVuln?.id === vuln.id;
                  return (
                    <tr
                      key={vuln.id}
                      onClick={() => setSelectedVuln(vuln)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-blue-500/10 dark:bg-blue-500/15' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${getCvssBadge(vuln.cvssScore)}`}>
                            {vuln.cvssScore.toFixed(1)}
                          </span>
                          <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                            {vuln.cveId}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate font-medium text-slate-800 dark:text-slate-200">
                        {vuln.title}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-slate-500 text-[11px]">
                        {vuln.software || (vuln as any).affectedSoftware || 'General Package'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase font-mono ${
                          vuln.status === 'OPEN' ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20' :
                          vuln.status === 'IN_PROGRESS' ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' :
                          'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                        }`}>
                          {vuln.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Vulnerability Detail & Fix Guide (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {selectedVuln ? (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
              <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono font-bold text-blue-500">{selectedVuln.cveId}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${getCvssBadge(selectedVuln.cvssScore)}`}>
                      CVSS {selectedVuln.cvssScore} ({selectedVuln.severity})
                    </span>
                  </div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    {selectedVuln.title}
                  </h3>
                </div>
              </div>

              <div className="space-y-3 text-xs leading-relaxed">
                <div>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Description:</span>
                  <p className="text-slate-600 dark:text-slate-400 mt-0.5">{selectedVuln.description}</p>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 space-y-1 font-mono text-[11px]">
                  <div>Affected Package: <strong className="text-slate-800 dark:text-slate-200">{selectedVuln.software || (selectedVuln as any).affectedSoftware || 'System'}</strong></div>
                  <div>Fix Version: <strong className="text-emerald-500">{selectedVuln.fixedVersion || (selectedVuln as any).remediationVersion || 'Latest vendor patch'}</strong></div>
                  <div>First Discovered: <span className="text-slate-400">{new Date(selectedVuln.detectionDate || selectedVuln.createdAt || Date.now()).toLocaleDateString()}</span></div>
                </div>

                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-900 dark:text-emerald-300 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <span>Remediation Guidance:</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">{selectedVuln.remediationGuidance || (selectedVuln as any).remediationPlan || 'Apply vendor provided patch and audit configurations.'}</p>
                </div>

                {/* Status Toggle Actions */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-slate-500 text-[11px]">Update Lifecycle:</span>
                  <div className="space-x-1.5">
                    {selectedVuln.status !== 'REMEDIATED' && (
                      <button
                        onClick={() => handleUpdateStatus(selectedVuln.id, 'REMEDIATED')}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold"
                      >
                        Mark Remediated
                      </button>
                    )}
                    {selectedVuln.status === 'OPEN' && (
                      <button
                        onClick={() => handleUpdateStatus(selectedVuln.id, 'IN_PROGRESS')}
                        className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-semibold"
                      >
                        In Progress
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400 text-xs">
              Select a vulnerability to view remediation playbooks.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
