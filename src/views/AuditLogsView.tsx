import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { AuditLog } from '../types';
import {
  ShieldCheck,
  Search,
  Filter,
  User,
  Clock,
  Terminal,
  Lock
} from 'lucide-react';

export const AuditLogsView: React.FC = () => {
  const { selectedOrgId, refreshTrigger } = useApp();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadLogs = async () => {
      try {
        setIsLoading(true);
        const data = await api.getAuditLogs();
        setLogs(data);
      } catch (err) {
        console.error('Failed to load audit logs:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadLogs();
  }, [selectedOrgId, refreshTrigger]);

  const filteredLogs = logs.filter(l => {
    const q = (searchQuery || '').toLowerCase().trim();
    const actor = (l.actor || (l as any).actorName || l.actorEmail || '').toLowerCase();
    const action = (l.action || '').toLowerCase();
    const resource = (l.resource || (l as any).resourceType || '').toLowerCase();
    const resourceId = (l.resourceId || '').toLowerCase();
    const ip = (l.sourceIP || (l as any).ipAddress || '').toLowerCase();
    const details = (l.details ? JSON.stringify(l.details) : (l as any).description || '').toLowerCase();

    return !q ||
      actor.includes(q) ||
      action.includes(q) ||
      resource.includes(q) ||
      resourceId.includes(q) ||
      ip.includes(q) ||
      details.includes(q);
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
          Immutable SOC Audit Trail & Access Logs
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Tamper-evident system activity ledger for compliance, forensic verification, and administrative accountability
        </p>
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-2">
        <Search className="w-4 h-4 text-slate-400 ml-1" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter audit logs by actor, action type, IP address..."
          className="bg-transparent text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none w-full"
        />
      </div>

      {/* Logs Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800 font-sans">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Actor / Operator</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Target Resource</th>
                <th className="px-4 py-3">IP Address</th>
                <th className="px-4 py-3">Audit Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredLogs.map(log => {
                const actorDisplay = log.actor || (log as any).actorName || log.actorEmail || 'System';
                const resourceDisplay = `${log.resource || (log as any).resourceType || 'Resource'}: ${log.resourceId || 'Global'}`;
                const ipDisplay = log.sourceIP || (log as any).ipAddress || '127.0.0.1';
                const detailsDisplay = log.details ? (typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details)) : ((log as any).description || 'Activity recorded in immutable ledger.');

                return (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 text-[11px]">
                    <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-sans font-semibold text-slate-800 dark:text-slate-200">
                      <div>{actorDisplay}</div>
                      {log.organizationName && (
                        <div className="text-[10px] text-slate-400 font-normal">{log.organizationName}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${
                        log.result === 'FAILURE' || log.result === 'DENIED' ? 'bg-rose-500/10 text-rose-500' : 'bg-blue-500/10 text-blue-500'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-slate-300">
                      {resourceDisplay}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-500 font-mono">
                      {ipDisplay}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-300 max-w-sm truncate text-[10px]">
                      {detailsDisplay}
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
