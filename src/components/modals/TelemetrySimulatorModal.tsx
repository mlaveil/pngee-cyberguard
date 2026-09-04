import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { Zap, X, ShieldAlert, CheckCircle2, RefreshCw, Terminal } from 'lucide-react';

interface TelemetrySimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const TelemetrySimulatorModal: React.FC<TelemetrySimulatorModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { availableOrgs, currentOrg, isSuperAdmin, isSecAnalyst } = useAuth();
  const { addToast } = useApp();

  const [selectedOrgId, setSelectedOrgId] = useState<string>(currentOrg?.id || 'org-apex-logistics');
  const [sourceType, setSourceType] = useState<string>('EDR_AGENT');
  const [severity, setSeverity] = useState<string>('HIGH');
  const [eventCategory, setEventCategory] = useState<string>('Malware');
  const [eventDescription, setEventDescription] = useState<string>('EDR detected process injection attempting LSASS memory credential harvesting (Mimikatz signature).');
  const [sourceIP, setSourceIP] = useState<string>('192.168.10.45');
  const [destinationIP, setDestinationIP] = useState<string>('192.168.10.254');
  const [host, setHost] = useState<string>('APEX-SRV-01');
  const [username, setUsername] = useState<string>('svc_backup');
  const [mitreTechnique, setMitreTechnique] = useState<string>('T1003 (OS Credential Dumping)');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  if (!isOpen) return null;

  const presets = [
    {
      name: '🔴 LSASS Credential Dump (EDR Alert)',
      category: 'Malware',
      severity: 'CRITICAL',
      sourceType: 'EDR_AGENT',
      desc: 'EDR Agent blocked lsass.exe process memory read from unsigned executable payload.exe.',
      mitre: 'T1003.001 (LSASS Memory)',
      host: 'APEX-DC-01',
      user: 'svc_backup',
      ip: '10.100.1.10'
    },
    {
      name: '🟠 Perimeter SSH Brute Force (Firewall)',
      category: 'Authentication',
      severity: 'HIGH',
      sourceType: 'FIREWALL',
      desc: 'Firewall detected 25 failed SSH login attempts in 60 seconds from external IP.',
      mitre: 'T1110 (Brute Force)',
      host: 'APEX-FW-01',
      user: 'root',
      ip: '198.51.100.124'
    },
    {
      name: '🟡 Impossible Travel Login (Azure AD)',
      category: 'Identity',
      severity: 'HIGH',
      sourceType: 'IDENTITY_PROVIDER',
      desc: 'Azure AD logged successful login from Moscow, RU 15 minutes after login from Chicago, US.',
      mitre: 'T1078 (Valid Accounts)',
      host: 'AzureAD',
      user: 'm.vance@apexlogistics.com',
      ip: '185.220.101.5'
    },
    {
      name: '🔵 SQL Injection on Web Server',
      category: 'Network',
      severity: 'MEDIUM',
      sourceType: 'SYSLOG',
      desc: 'WAF blocked URI parameter containing UNION SELECT * FROM users-- query injection.',
      mitre: 'T1190 (Exploit Public-Facing Application)',
      host: 'APEX-WEB-01',
      user: 'anonymous',
      ip: '203.0.113.88'
    }
  ];

  const applyPreset = (p: typeof presets[0]) => {
    setEventCategory(p.category);
    setSeverity(p.severity);
    setSourceType(p.sourceType);
    setEventDescription(p.desc);
    setMitreTechnique(p.mitre);
    setHost(p.host);
    setUsername(p.user);
    setSourceIP(p.ip);
  };

  const handleSimulate = async () => {
    setIsSubmitting(true);
    setLastResult(null);

    try {
      const res = await api.ingestTelemetry({
        organizationId: selectedOrgId,
        source: `Telemetry-Simulator (${sourceType})`,
        sourceType,
        severity,
        eventCategory,
        eventDescription,
        sourceIP,
        destinationIP,
        host,
        username,
        mitreTechnique
      });

      setLastResult(res);
      addToast(
        'Telemetry Ingested',
        res.generatedAlert 
          ? `Event ingested and matched Detection Rule! Created Alert: ${res.generatedAlert.id}`
          : 'Event normalized and stored in telemetry log.',
        res.generatedAlert ? 'warning' : 'success'
      );
      onSuccess();
    } catch (err: any) {
      addToast('Ingestion Error', err.message || 'Failed to ingest telemetry', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-amber-500/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Live Cybersecurity Telemetry Simulator
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Inject synthetic security events into the real-time detection & correlation engine
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* Quick Attack Presets */}
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
              Quick Attack Scenarios:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {presets.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className="text-left p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-amber-500/50 bg-slate-50 dark:bg-slate-800 hover:bg-amber-500/5 transition-all text-xs"
                >
                  <div className="font-semibold text-slate-800 dark:text-slate-200">{p.name}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{p.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Target Organization */}
          {(isSuperAdmin || isSecAnalyst) && (
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Target Customer Organization
              </label>
              <select
                value={selectedOrgId}
                onChange={(e) => setSelectedOrgId(e.target.value)}
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-slate-100"
              >
                {availableOrgs.map(o => (
                  <option key={o.id} value={o.id}>{o.name} ({o.domain})</option>
                ))}
              </select>
            </div>
          )}

          {/* Form Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Telemetry Source Type
              </label>
              <select
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value)}
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2"
              >
                <option value="EDR_AGENT">EDR Agent</option>
                <option value="FIREWALL">Perimeter Firewall</option>
                <option value="IDENTITY_PROVIDER">Identity Provider (Azure AD/Okta)</option>
                <option value="SYSLOG">Syslog / Host Server</option>
                <option value="CLOUD_TRAIL">CloudTrail / AWS</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Severity Rating
              </label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2"
              >
                <option value="CRITICAL">🔴 CRITICAL</option>
                <option value="HIGH">🟠 HIGH</option>
                <option value="MEDIUM">🟡 MEDIUM</option>
                <option value="LOW">🔵 LOW</option>
                <option value="INFORMATIONAL">⚪ INFORMATIONAL</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Event Category
              </label>
              <input
                type="text"
                value={eventCategory}
                onChange={(e) => setEventCategory(e.target.value)}
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Target Hostname
              </label>
              <input
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                User / Account
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Source IP Address
              </label>
              <input
                type="text"
                value={sourceIP}
                onChange={(e) => setSourceIP(e.target.value)}
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                MITRE ATT&CK Technique
              </label>
              <input
                type="text"
                value={mitreTechnique}
                onChange={(e) => setMitreTechnique(e.target.value)}
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Event Description & Evidence
            </label>
            <textarea
              rows={2}
              value={eventDescription}
              onChange={(e) => setEventDescription(e.target.value)}
              className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-mono"
            />
          </div>

          {/* Result Banner if any */}
          {lastResult && (
            <div className={`p-3 rounded-lg border text-xs ${
              lastResult.generatedAlert 
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
            }`}>
              <div className="flex items-center gap-2 font-bold mb-1">
                {lastResult.generatedAlert ? <ShieldAlert className="w-4 h-4 text-rose-500" /> : <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                <span>{lastResult.generatedAlert ? '🔥 Threat Correlated & Security Alert Generated!' : '✅ Telemetry Normalized & Indexed'}</span>
              </div>
              <div>Event ID: <code className="font-mono">{lastResult.event.id}</code></div>
              {lastResult.generatedAlert && (
                <div className="mt-1 font-mono">
                  Alert ID: {lastResult.generatedAlert.id} | Severity: {lastResult.generatedAlert.severity} | Rule: {lastResult.generatedAlert.detectionRuleName}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2 bg-slate-50 dark:bg-slate-900">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleSimulate}
            disabled={isSubmitting}
            className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all"
          >
            {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            <span>Ingest & Run Detection Engine</span>
          </button>
        </div>
      </div>
    </div>
  );
};
