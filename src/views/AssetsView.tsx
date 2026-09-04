import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { Asset, AgentEnrollmentToken } from '../types';
import {
  Server,
  Plus,
  Key,
  ShieldCheck,
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  Cpu,
  HardDrive,
  Copy,
  Check,
  Terminal,
  Activity,
  AlertTriangle,
  Laptop,
  CheckCircle2,
  XCircle
} from 'lucide-react';

export const AssetsView: React.FC = () => {
  const { currentOrg, isSuperAdmin, isSecAnalyst, isCustomerAdmin } = useAuth();
  const { selectedOrgId, refreshTrigger, addToast } = useApp();

  const [assets, setAssets] = useState<Asset[]>([]);
  const [tokens, setTokens] = useState<AgentEnrollmentToken[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // New Asset Form
  const [newHostname, setNewHostname] = useState('');
  const [newIp, setNewIp] = useState('');
  const [newOs, setNewOs] = useState('Windows Server 2022');
  const [newType, setNewType] = useState<Asset['assetType']>('SERVER');
  const [newCriticality, setNewCriticality] = useState<Asset['criticality']>('HIGH');

  const loadAssets = async () => {
    try {
      setIsLoading(true);
      const [aData, tData] = await Promise.all([
        api.getAssets({ type: typeFilter, status: statusFilter }),
        api.getEnrollmentTokens()
      ]);
      setAssets(aData);
      setTokens(tData);
      if (aData.length > 0 && !selectedAsset) {
        setSelectedAsset(aData[0]);
      }
    } catch (err) {
      console.error('Failed to load assets:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAssets();
  }, [selectedOrgId, typeFilter, statusFilter, refreshTrigger]);

  const handleRegisterAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await api.createAsset({
        hostname: newHostname,
        ipAddress: newIp,
        operatingSystem: newOs,
        assetType: newType,
        criticality: newCriticality
      });
      addToast('Asset Registered', `Registered ${created.hostname} into monitoring inventory.`, 'success');
      setShowRegisterModal(false);
      setNewHostname('');
      setNewIp('');
      loadAssets();
    } catch (err: any) {
      addToast('Registration Failed', err.message || 'Failed to create asset', 'error');
    }
  };

  const handleCreateToken = async () => {
    try {
      const tok = await api.createEnrollmentToken({
        name: `EDR Agent Key (${new Date().toLocaleDateString()})`,
        osTarget: 'all'
      });
      addToast('Enrollment Token Created', 'New agent enrollment token generated.', 'success');
      loadAssets();
    } catch (err: any) {
      addToast('Token Creation Failed', err.message, 'error');
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedToken(id);
    setTimeout(() => setCopiedToken(null), 2500);
    addToast('Copied', 'Enrollment key copied to clipboard', 'info');
  };

  const filteredAssets = assets.filter(a => {
    const q = (searchQuery || '').toLowerCase().trim();
    return !q ||
      (a.hostname && a.hostname.toLowerCase().includes(q)) ||
      (a.ipAddress && a.ipAddress.toLowerCase().includes(q)) ||
      (a.operatingSystem && a.operatingSystem.toLowerCase().includes(q)) ||
      (a.assetType && a.assetType.toLowerCase().includes(q)) ||
      (a.tags && a.tags.some(t => t && t.toLowerCase().includes(q)));
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Asset Inventory & Endpoint Telemetry
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time status of managed workstations, domain controllers, servers, and firewalls
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowTokenModal(true)}
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Key className="w-3.5 h-3.5 text-amber-500" />
            <span>Agent Enrollment Keys ({tokens.filter(t => !t.isRevoked).length})</span>
          </button>
          {(isSuperAdmin || isSecAnalyst || isCustomerAdmin) && (
            <button
              onClick={() => setShowRegisterModal(true)}
              className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm shadow-blue-500/20 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Register Asset</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 ml-1" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search assets by hostname, IP address, OS..."
            className="bg-transparent text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none w-full"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-xs bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200"
          >
            <option value="">All Asset Types</option>
            <option value="SERVER">Servers</option>
            <option value="WORKSTATION">Workstations</option>
            <option value="FIREWALL">Firewalls</option>
            <option value="DOMAIN_CONTROLLER">Domain Controllers</option>
            <option value="CLOUD_INSTANCE">Cloud Instances</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200"
          >
            <option value="">All Statuses</option>
            <option value="ONLINE">Online</option>
            <option value="OFFLINE">Offline</option>
            <option value="DEGRADED">Degraded</option>
          </select>
        </div>
      </div>

      {/* Assets Layout: Table + Live Telemetry Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Table (2 cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Asset Hostname</th>
                  <th className="px-4 py-3">IP / OS</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">EDR Agent</th>
                  <th className="px-4 py-3">Security</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredAssets.map(asset => {
                  const isSelected = selectedAsset?.id === asset.id;
                  return (
                    <tr
                      key={asset.id}
                      onClick={() => setSelectedAsset(asset)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-500/10 dark:bg-blue-500/15 font-medium'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-bold text-slate-900 dark:text-white font-mono text-xs">
                          {asset.hostname}
                        </div>
                        <div className="text-[10px] text-slate-400 font-sans">
                          {asset.criticality} Criticality
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-slate-600 dark:text-slate-300">
                        <div>{asset.ipAddress}</div>
                        <div className="text-[10px] text-slate-400 font-sans truncate max-w-[150px]">
                          {asset.operatingSystem}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {asset.assetType}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          asset.status === 'ONLINE'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${asset.status === 'ONLINE' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          {asset.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-[11px] font-mono text-slate-600 dark:text-slate-400">
                          {asset.agentVersion || 'None'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                          asset.securityStatus === 'SECURE'
                            ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                            : asset.securityStatus === 'COMPROMISED'
                            ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20 animate-pulse'
                            : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                        }`}>
                          {asset.securityStatus}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Asset Telemetry & Diagnostics Panel */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
          {selectedAsset ? (
            <>
              <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white font-mono">
                      {selectedAsset.hostname}
                    </h3>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 font-mono">
                      {selectedAsset.ipAddress}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {selectedAsset.operatingSystem} ({selectedAsset.osVersion})
                  </p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                  selectedAsset.status === 'ONLINE' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                }`}>
                  {selectedAsset.status}
                </span>
              </div>

              {/* Real-time System Telemetry */}
              {selectedAsset.telemetry && (
                <div className="space-y-3 text-xs">
                  <div className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-cyan-500" />
                    <span>Real-time Resource Telemetry</span>
                  </div>

                  {/* CPU Usage */}
                  <div>
                    <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                      <span>CPU Utilization</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{selectedAsset.telemetry.cpuUsagePercent}%</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-cyan-500 h-full" style={{ width: `${selectedAsset.telemetry.cpuUsagePercent}%` }} />
                    </div>
                  </div>

                  {/* RAM Usage */}
                  <div>
                    <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                      <span>RAM Utilization</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{selectedAsset.telemetry.ramUsagePercent}%</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-blue-500 h-full" style={{ width: `${selectedAsset.telemetry.ramUsagePercent}%` }} />
                    </div>
                  </div>

                  {/* Security Controls Checklist */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                    <div className="font-semibold text-slate-700 dark:text-slate-300">
                      Defensive Controls Status
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="flex items-center gap-1.5 p-2 rounded bg-slate-50 dark:bg-slate-800/50">
                        {selectedAsset.telemetry.antivirusEnabled ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <XCircle className="w-3.5 h-3.5 text-rose-500" />}
                        <span>Antivirus (EDR)</span>
                      </div>
                      <div className="flex items-center gap-1.5 p-2 rounded bg-slate-50 dark:bg-slate-800/50">
                        {selectedAsset.telemetry.firewallEnabled ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <XCircle className="w-3.5 h-3.5 text-rose-500" />}
                        <span>Host Firewall</span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-800 dark:text-amber-300 flex items-center justify-between">
                      <span>Missing Security Patches:</span>
                      <strong className="font-mono font-bold">{selectedAsset.telemetry.missingPatchesCount} Updates</strong>
                    </div>

                    <div className="text-[11px] text-slate-500 pt-1">
                      <span>Active Processes: <strong className="text-slate-700 dark:text-slate-300 font-mono">{selectedAsset.telemetry.runningProcessesCount}</strong></span>
                      <span className="mx-2">•</span>
                      <span>Logged In: <strong className="text-slate-700 dark:text-slate-300 font-mono">{selectedAsset.telemetry.loggedInUsers.join(', ')}</strong></span>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-slate-400 text-xs">
              Select an asset from the table to inspect telemetry and security controls.
            </div>
          )}
        </div>
      </div>

      {/* Register Asset Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Register New Monitored Endpoint
            </h2>
            <form onSubmit={handleRegisterAsset} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">Asset Hostname</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. APEX-DB-02"
                  value={newHostname}
                  onChange={(e) => setNewHostname(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-mono"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">IP Address</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. 10.100.1.45"
                  value={newIp}
                  onChange={(e) => setNewIp(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Asset Type</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2"
                  >
                    <option value="SERVER">Server</option>
                    <option value="WORKSTATION">Workstation</option>
                    <option value="FIREWALL">Firewall</option>
                    <option value="DOMAIN_CONTROLLER">Domain Controller</option>
                    <option value="CLOUD_INSTANCE">Cloud Instance</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold block mb-1">Criticality</label>
                  <select
                    value={newCriticality}
                    onChange={(e) => setNewCriticality(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2"
                  >
                    <option value="CRITICAL">Critical</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="font-semibold block mb-1">Operating System</label>
                <input
                  type="text"
                  value={newOs}
                  onChange={(e) => setNewOs(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-4 py-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-sm"
                >
                  Register
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Enrollment Token Modal */}
      {showTokenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Agent Enrollment Keys & Installation Script
                </h2>
                <p className="text-xs text-slate-500">
                  Deploy the PNGee CyberGuard telemetry daemon to Windows, Linux, and macOS endpoints
                </p>
              </div>
              <button onClick={() => setShowTokenModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Active Enrollment Keys</span>
                <button
                  onClick={handleCreateToken}
                  className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded font-bold text-xs flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Generate Key
                </button>
              </div>

              {tokens.map(t => (
                <div key={t.id} className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900 dark:text-white">{t.name}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${t.isRevoked ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                      {t.isRevoked ? 'REVOKED' : 'ACTIVE'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[11px] bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800">
                    <span className="truncate flex-1 text-slate-600 dark:text-slate-300">{t.tokenKey}</span>
                    <button
                      onClick={() => copyToClipboard(t.tokenKey, t.id)}
                      className="text-blue-500 hover:text-blue-600 p-1"
                    >
                      {copiedToken === t.id ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ))}

              <div className="pt-2">
                <label className="font-semibold block mb-1 text-slate-700 dark:text-slate-300">
                  Quick Install Command (Windows PowerShell):
                </label>
                <div className="p-2.5 rounded bg-slate-950 text-cyan-400 font-mono text-[11px] overflow-x-auto">
                  iex ((New-Object System.Net.WebClient).DownloadString('https://agent.pngeecyberguard.com/install.ps1')); Initialize-PNGeeAgent -Token "{tokens[0]?.tokenKey || 'PNGEE_TOKEN_HERE'}"
                </div>
              </div>
            </div>

            <div className="pt-3 flex justify-end">
              <button
                onClick={() => setShowTokenModal(false)}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold text-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
