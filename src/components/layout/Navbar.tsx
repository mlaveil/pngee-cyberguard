import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import {
  Building2,
  UserCheck,
  Sparkles,
  Sun,
  Moon,
  Zap,
  ChevronDown,
  RefreshCw,
  FlaskConical,
  Search
} from 'lucide-react';

interface NavbarProps {
  onOpenTelemetrySimulator: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenTelemetrySimulator }) => {
  const { currentUser, currentOrg, availableOrgs, allDemoUsers, switchUser, isSuperAdmin, isSecAnalyst } = useAuth();
  const { selectedOrgId, setSelectedOrgId, theme, toggleTheme, setIsAiModalOpen, triggerRefresh, setActiveView } = useApp();

  return (
    <header className="h-16 border-b border-slate-200 dark:border-[#1F1F23] bg-white dark:bg-[#0A0A0B] sticky top-0 z-30 px-4 sm:px-6 flex items-center justify-between transition-colors">
      {/* Brand & Live SOC Status */}
      <div className="flex items-center gap-4 lg:gap-6">
        <div 
          onClick={() => setActiveView('dashboard')}
          className="flex items-center gap-3 cursor-pointer group select-none"
        >
          <div className="w-8 h-8 bg-[#F27D26] rounded flex items-center justify-center font-black text-black text-xs tracking-wider shadow-sm group-hover:scale-105 transition-transform">
            PNG
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-slate-900 dark:text-white">
                PNGee CyberGuard
              </span>
              <div className="hidden sm:flex bg-slate-100 dark:bg-[#111114] rounded border border-slate-200 dark:border-[#1F1F23] items-center px-2 py-0.5 gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-[9px] uppercase font-bold text-slate-600 dark:text-[#888] tracking-wider">Production Healthy</span>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-[#666] hidden md:block">
              Tenant: <span className="text-[#F27D26] font-semibold">{selectedOrgId === 'all' ? 'PNGee IT Solutions (Global MSP Operations)' : currentOrg?.name || 'Assigned Organization'}</span>
            </p>
          </div>
        </div>

        {/* Tenant Switcher (For PNGee Staff) or Fixed Organization Badge */}
        <div className="hidden md:flex items-center pl-4 border-l border-slate-200 dark:border-[#1F1F23]">
          {(isSuperAdmin || isSecAnalyst) ? (
            <div className="flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5 text-slate-400 dark:text-[#666]" />
              <div className="relative">
                <select
                  value={selectedOrgId}
                  onChange={(e) => setSelectedOrgId(e.target.value)}
                  className="bg-slate-100 dark:bg-[#111114] text-slate-900 dark:text-[#E0E0E0] text-xs font-medium rounded-lg px-2.5 py-1.5 pr-7 border border-slate-200 dark:border-[#1F1F23] focus:outline-none focus:border-[#F27D26] cursor-pointer appearance-none"
                >
                  <option value="all">🌐 All Managed Tenants (MSP Aggregation)</option>
                  {availableOrgs.map((org) => (
                    <option key={org.id} value={org.id}>
                      🏢 {org.name} ({org.plan.replace('PNGEE_', '').replace('STK_', '')})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-[#666] absolute right-2 top-2 pointer-events-none" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#111114] border border-slate-200 dark:border-[#1F1F23]">
              <Building2 className="w-3.5 h-3.5 text-[#F27D26]" />
              <span className="text-xs font-semibold text-slate-800 dark:text-[#AAA]">
                {currentOrg?.name || 'Assigned Organization'}
              </span>
              <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-[#F27D26]/10 text-[#F27D26] border border-[#F27D26]/20 font-bold">
                {currentOrg?.plan?.replace('PNGEE_', '').replace('STK_', '') || 'BUSINESS'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Right Actions: Persona Switcher, Telemetry Injector, AI SOC, Theme, User */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* Quick Persona / RBAC Switcher Dropdown */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-[#111114] p-1 rounded-lg border border-slate-200 dark:border-[#1F1F23]">
          <UserCheck className="w-3.5 h-3.5 text-[#F27D26] ml-1" />
          <span className="text-[10px] font-bold text-slate-500 dark:text-[#666] uppercase tracking-wider hidden xl:inline">Role:</span>
          <select
            value={currentUser?.id || ''}
            onChange={(e) => switchUser(e.target.value)}
            className="bg-white dark:bg-[#1A1A1D] text-slate-900 dark:text-[#AAA] text-xs font-medium rounded px-2 py-1 border border-slate-200 dark:border-[#333] focus:outline-none focus:border-[#F27D26] cursor-pointer"
            title="Switch User Persona to test Multi-Tenant Isolation and RBAC"
          >
            <optgroup label="PNGee IT Solutions SOC Team">
              {allDemoUsers.filter(u => u.role.startsWith('PNGEE_') || u.role.startsWith('STK_')).map(u => (
                <option key={u.id} value={u.id}>
                  ⭐ {u.name} ({u.role.replace('PNGEE_', '').replace('STK_', '')})
                </option>
              ))}
            </optgroup>
            <optgroup label="Customer Tenants">
              {allDemoUsers.filter(u => !u.role.startsWith('PNGEE_') && !u.role.startsWith('STK_')).map(u => (
                <option key={u.id} value={u.id}>
                  👤 {u.name} ({u.role.replace('CUSTOMER_', '')})
                </option>
              ))}
            </optgroup>
          </select>
        </div>

        {/* Telemetry Attack Simulator Trigger */}
        <button
          onClick={onOpenTelemetrySimulator}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F27D26]/10 hover:bg-[#F27D26]/20 text-[#F27D26] border border-[#F27D26]/30 text-xs font-bold uppercase tracking-wider transition-colors"
          title="Simulate incoming attack telemetry (EDR, Firewall, Brute-Force)"
        >
          <Zap className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Simulate</span>
        </button>

        {/* AI SOC Copilot Button */}
        <button
          onClick={() => setIsAiModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1A1A1D] hover:bg-[#252529] text-white border border-[#333] text-xs font-semibold shadow-xs transition-all hover:border-[#F27D26]"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#F27D26]" />
          <span className="hidden md:inline">AI SOC</span>
        </button>

        {/* Automated Tests View Shortcut */}
        <button
          onClick={() => setActiveView('tests')}
          className="p-2 rounded-lg text-slate-500 dark:text-[#888] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#151518] border border-transparent hover:border-slate-200 dark:hover:border-[#1F1F23] transition-colors"
          title="Run Automated Platform Tests"
        >
          <FlaskConical className="w-4 h-4" />
        </button>

        {/* Refresh button */}
        <button
          onClick={triggerRefresh}
          className="p-2 rounded-lg text-slate-500 dark:text-[#888] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#151518] border border-transparent hover:border-slate-200 dark:hover:border-[#1F1F23] transition-colors"
          title="Refresh Telemetry Data"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-slate-500 dark:text-[#888] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#151518] border border-transparent hover:border-slate-200 dark:hover:border-[#1F1F23] transition-colors"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-[#F27D26]" /> : <Moon className="w-4 h-4 text-slate-700" />}
        </button>
      </div>
    </header>
  );
};
