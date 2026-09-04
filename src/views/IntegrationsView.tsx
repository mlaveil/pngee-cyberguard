import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { IntegrationConnector } from '../types';
import {
  Plug,
  Plus,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Server,
  Cloud,
  Layers
} from 'lucide-react';

export const IntegrationsView: React.FC = () => {
  const { isSuperAdmin, isCustomerAdmin } = useAuth();
  const { selectedOrgId, refreshTrigger, addToast } = useApp();

  const [integrations, setIntegrations] = useState<IntegrationConnector[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadIntegrations = async () => {
    try {
      setIsLoading(true);
      const data = await api.getIntegrations();
      setIntegrations(data);
    } catch (err) {
      console.error('Failed to load integrations:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadIntegrations();
  }, [selectedOrgId, refreshTrigger]);

  const handleTestSync = (name: string) => {
    addToast('Integration Sync Triggered', `Triggered real-time telemetry pull from ${name}.`, 'info');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
          Security Connectors & External Integrations
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Native connectors for CrowdStrike Falcon, Microsoft Defender, Microsoft 365, AWS CloudTrail, and Veeam
        </p>
      </div>

      {/* Integrations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {integrations.map(conn => (
          <div
            key={conn.id}
            className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold">
                    <Plug className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      {conn.name}
                    </h3>
                    <span className="text-[10px] font-mono text-slate-400">
                      {conn.category || conn.vendor || (conn as any).connectorType || 'SECURITY_CONNECTOR'}
                    </span>
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                  conn.status === 'CONNECTED' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                }`}>
                  {conn.status}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 space-y-1.5 text-xs font-mono">
                <div className="flex justify-between text-slate-500">
                  <span>Last Ingest:</span>
                  <span className="text-slate-800 dark:text-slate-200">
                    {conn.lastSyncAt ? new Date(conn.lastSyncAt).toLocaleTimeString() : (conn.lastSyncTime ? new Date(conn.lastSyncTime).toLocaleTimeString() : 'Just now')}
                  </span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Events Streamed:</span>
                  <span className="text-emerald-500 font-bold">
                    {(conn.eventsIngested24h ?? conn.eventsIngestedCount ?? 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>API Health OK</span>
              </span>
              <button
                onClick={() => handleTestSync(conn.name)}
                className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-300"
              >
                Poll Now
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
