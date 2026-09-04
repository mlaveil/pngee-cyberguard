import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { ThreatIntelIndicator } from '../types';
import {
  ShieldAlert,
  Search,
  Filter,
  Plus,
  Radio,
  ExternalLink,
  Lock,
  Globe,
  Flame,
  CheckCircle2
} from 'lucide-react';

export const ThreatIntelView: React.FC = () => {
  const { isSuperAdmin } = useAuth();
  const { refreshTrigger, addToast } = useApp();

  const [threats, setThreats] = useState<ThreatIntelIndicator[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const loadThreats = async () => {
    try {
      const data = await api.getThreatIntel();
      setThreats(data);
    } catch (err) {
      console.error('Failed to load threat intel:', err);
    }
  };

  useEffect(() => {
    loadThreats();
  }, [refreshTrigger]);

  const filteredThreats = threats.filter(t => {
    const q = (searchQuery || '').toLowerCase().trim();
    const indVal = t.indicator || (t as any).indicatorValue || '';
    const actor = t.threatGroup || (t as any).threatActor || '';
    const malware = t.malwareFamily || (t as any).description || t.source || '';
    const matchesSearch = !q ||
      indVal.toLowerCase().includes(q) ||
      actor.toLowerCase().includes(q) ||
      malware.toLowerCase().includes(q);
    const indType = t.type || (t as any).indicatorType || '';
    const matchesType = !typeFilter || indType === typeFilter || (typeFilter === 'FILE_HASH' && indType.includes('HASH'));
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
          Global Threat Intelligence & IOC Feed
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Real-time indicators of compromise (IOCs), malicious C2 infrastructure, and nation-state threat actor mapping
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
            placeholder="Search indicators by IP, domain, hash, or actor..."
            className="bg-transparent text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none w-full"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-xs bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200"
          >
            <option value="">All Indicator Types</option>
            <option value="IP">IP Address</option>
            <option value="DOMAIN">Domain</option>
            <option value="FILE_HASH">File Hash (SHA-256)</option>
            <option value="URL">URL</option>
          </select>
        </div>
      </div>

      {/* Threat Intel Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800 font-sans">
              <tr>
                <th className="px-4 py-3">Indicator (IOC)</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Threat Actor & Campaign</th>
                <th className="px-4 py-3">Confidence</th>
                <th className="px-4 py-3">MITRE TTP</th>
                <th className="px-4 py-3">Feed Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredThreats.map(threat => {
                const indicatorVal = threat.indicator || (threat as any).indicatorValue || 'N/A';
                const typeVal = threat.type || (threat as any).indicatorType || 'IOC';
                const groupVal = threat.threatGroup || (threat as any).threatActor || 'Advanced Threat Group';
                const confidenceVal = threat.confidence ?? (threat as any).confidenceScore ?? 85;
                const tacticVal = threat.reputation || (threat as any).mitreTactic || 'MALICIOUS';
                const sourceVal = threat.source || (threat as any).sourceFeed || 'Threat Feed';
                const detailsVal = threat.malwareFamily || (threat as any).description || `Detected on ${new Date(threat.lastSeen || Date.now()).toLocaleDateString()}`;

                return (
                  <tr key={threat.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-bold text-rose-600 dark:text-rose-400 text-xs">
                        {indicatorVal}
                      </div>
                      <div className="text-[10px] text-slate-400 font-sans truncate max-w-sm">
                        {detailsVal}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
                        {typeVal}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-sans">
                      <div className="font-bold text-slate-800 dark:text-slate-200">{groupVal}</div>
                      <div className="text-[10px] text-slate-400">{threat.malwareFamily || 'Enterprise Infrastructure Target'}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-sans">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-rose-500 h-full" style={{ width: `${confidenceVal}%` }} />
                        </div>
                        <span className="font-mono text-[11px] font-bold text-rose-500">{confidenceVal}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                        tacticVal === 'MALICIOUS' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                        'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {tacticVal}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-sans text-slate-500 text-[11px]">
                      {sourceVal}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
