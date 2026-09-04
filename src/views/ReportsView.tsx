import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { SecurityReport } from '../types';
import {
  FileText,
  Plus,
  Download,
  Printer,
  Sparkles,
  ShieldCheck,
  Calendar,
  Building2,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';

export const ReportsView: React.FC = () => {
  const { currentOrg, isSuperAdmin, isSecAnalyst, isCustomerAdmin } = useAuth();
  const { selectedOrgId, refreshTrigger, addToast } = useApp();

  const [reports, setReports] = useState<SecurityReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<SecurityReport | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [reportTitle, setReportTitle] = useState('Executive Monthly Cyber Health Assessment');
  const [reportType, setReportType] = useState<SecurityReport['reportType']>('EXECUTIVE');
  const [isGenerating, setIsGenerating] = useState(false);

  const loadReports = async () => {
    try {
      const data = await api.getReports();
      setReports(data);
      if (data.length > 0 && !selectedReport) {
        setSelectedReport(data[0]);
      }
    } catch (err) {
      console.error('Failed to load reports:', err);
    }
  };

  useEffect(() => {
    loadReports();
  }, [selectedOrgId, refreshTrigger]);

  const handleGenerateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    try {
      const created = await api.generateReport({
        title: reportTitle,
        reportType: reportType
      });
      addToast('Report Compiled', `Security report "${created.title}" successfully compiled.`, 'success');
      setShowGenerateModal(false);
      loadReports();
      setSelectedReport(created);
    } catch (err: any) {
      addToast('Generation Failed', err.message, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Executive Security Reports & Compliance Briefings
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            C-suite digestible cyber health audits, risk posture trends, and prioritized technical remediation roadmaps
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {(isSuperAdmin || isSecAnalyst || isCustomerAdmin) && (
            <button
              onClick={() => setShowGenerateModal(true)}
              className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm shadow-blue-500/20 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Compile Executive Report</span>
            </button>
          )}
        </div>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Reports Archive (4 cols) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col">
          <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 font-semibold text-xs text-slate-700 dark:text-slate-300">
            Generated Reports Archive ({reports.length})
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 overflow-y-auto max-h-[600px]">
            {reports.map(rep => {
              const isSelected = selectedReport?.id === rep.id;
              return (
                <div
                  key={rep.id}
                  onClick={() => setSelectedReport(rep)}
                  className={`p-4 cursor-pointer transition-all space-y-1.5 ${
                    isSelected
                      ? 'bg-blue-500/10 dark:bg-blue-500/15 border-l-4 border-l-blue-500'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 font-mono">
                      {rep.reportType}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(rep.generatedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white line-clamp-1">
                    {rep.title}
                  </h4>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                    <span>Score: <strong className="font-mono text-emerald-500">{rep.securityScore ?? 85}/100</strong></span>
                    <span>Incidents: <strong className="font-mono text-rose-500">{rep.incidentsSummary?.total ?? 0}</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Report Viewer (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {selectedReport ? (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 shadow-xs space-y-6 print:p-0 print:border-none">
              {/* Document Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400">PNGEE IT SOLUTIONS</span>
                    <span className="text-xs text-slate-400">• SOC MANAGED PNGEE CYBERGUARD</span>
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    {selectedReport.title}
                  </h2>
                  <div className="flex items-center gap-4 text-xs text-slate-500 mt-1">
                    <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> {selectedReport.organizationName || 'Apex Global'}</span>
                    <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Period: {selectedReport.dateRange?.start || '2026-08-01'} to {selectedReport.dateRange?.end || '2026-08-31'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 print:hidden">
                  <button
                    onClick={handlePrint}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print / PDF</span>
                  </button>
                </div>
              </div>

              {/* High-Level Score Snapshot Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 font-sans">
                <div>
                  <span className="text-[11px] text-slate-500">Security Score</span>
                  <div className="text-2xl font-black text-emerald-600 font-mono">
                    {selectedReport.securityScore ?? 85}/100
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500">Total Assets</span>
                  <div className="text-2xl font-black text-slate-800 dark:text-slate-200 font-mono">
                    {selectedReport.endpointHealthSummary?.total ?? 0}
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500">Open CVEs</span>
                  <div className="text-2xl font-black text-amber-500 font-mono">
                    {selectedReport.vulnerabilitiesSummary?.total ?? 0}
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500">Major Incidents</span>
                  <div className="text-2xl font-black text-rose-500 font-mono">
                    {selectedReport.incidentsSummary?.total ?? 0}
                  </div>
                </div>
              </div>

              {/* Executive Summary Narrative */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Executive Briefing & Threat Posture
                </h3>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {selectedReport.executiveSummary || 'Regular continuous posture assessment conducted by PNGee Managed SOC.'}
                </p>
              </div>

              {/* Top Recommendations */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  PNGee Recommended Action Roadmap
                </h3>
                <div className="space-y-2">
                  {(selectedReport.topRecommendations || []).map((rec, idx) => (
                    <div key={idx} className="flex items-start gap-2 p-2.5 rounded-lg bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/20 text-xs text-slate-800 dark:text-slate-200">
                      <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{rec}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-16 text-slate-400 text-xs">
              Select a security report to view the executive brief.
            </div>
          )}
        </div>
      </div>

      {/* Generate Report Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-500" />
              <span>Compile Executive Security Report</span>
            </h2>
            <form onSubmit={handleGenerateReport} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">Report Title</label>
                <input
                  required
                  type="text"
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">Report Category</label>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2"
                >
                  <option value="EXECUTIVE">Executive Monthly Brief (C-Suite)</option>
                  <option value="TECHNICAL">Technical Cyber Health Audit</option>
                  <option value="COMPLIANCE">Compliance Readiness Assessment</option>
                </select>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowGenerateModal(false)}
                  className="px-4 py-2 rounded-lg text-slate-500 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isGenerating}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center gap-1.5"
                >
                  {isGenerating && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Generate Report</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
