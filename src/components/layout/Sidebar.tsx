import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import {
  LayoutDashboard,
  ShieldAlert,
  Flame,
  Activity,
  Server,
  Bug,
  Lock,
  Building2,
  Users,
  FileText,
  Workflow,
  History,
  FlaskConical,
  Radio,
  HardDrive
} from 'lucide-react';

interface SidebarProps {
  counts?: {
    alerts: number;
    incidents: number;
    vulnerabilities: number;
    offlineAssets: number;
  };
}

export const Sidebar: React.FC<SidebarProps> = ({ counts }) => {
  const { currentUser, isSuperAdmin, isSecAnalyst, isCustomerAdmin } = useAuth();
  const { activeView, setActiveView } = useApp();

  const isPngeeStaff = isSuperAdmin || isSecAnalyst;

  const navGroups = [
    {
      group: 'Main',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { 
          id: 'assets', 
          label: 'Asset Inventory', 
          icon: Server,
          badge: counts?.offlineAssets ? `${counts.offlineAssets} off` : undefined,
          badgeColor: 'bg-slate-500 text-white'
        },
        ...(isPngeeStaff ? [{ id: 'organizations', label: 'Organizations', icon: Building2 }] : []),
        ...((isPngeeStaff || isCustomerAdmin) ? [{ id: 'users', label: 'User Directory', icon: Users }] : []),
      ]
    },
    {
      group: 'Security Ops',
      items: [
        { 
          id: 'alerts', 
          label: 'Alert Queue', 
          icon: ShieldAlert,
          badge: counts?.alerts ? counts.alerts : undefined,
          badgeColor: 'bg-[#F27D26] text-black font-bold'
        },
        { 
          id: 'incidents', 
          label: 'Incident Center', 
          icon: Flame,
          badge: counts?.incidents ? counts.incidents : undefined,
          badgeColor: 'bg-red-500 text-white'
        },
        { 
          id: 'vulnerabilities', 
          label: 'Vulnerabilities', 
          icon: Bug,
          badge: counts?.vulnerabilities ? counts.vulnerabilities : undefined,
          badgeColor: 'bg-red-500/80 text-white'
        },
        { id: 'monitoring', label: 'Monitoring', icon: Activity },
        { id: 'threat-intel', label: 'Threat Intel', icon: Radio },
      ]
    },
    {
      group: 'Commercial & Infra',
      items: [
        { id: 'system-health', label: 'System & License', icon: HardDrive },
        { id: 'specialized', label: 'Certs & Domains', icon: Lock },
        { id: 'reports', label: 'Executive Reports', icon: FileText },
        ...(isPngeeStaff ? [{ id: 'integrations', label: 'Integrations', icon: Workflow }] : []),
        { id: 'audit-logs', label: 'Audit Trail', icon: History },
        { id: 'tests', label: 'Test Suite', icon: FlaskConical },
      ]
    }
  ];

  return (
    <aside className="w-64 border-r border-slate-200 dark:border-[#1F1F23] bg-white dark:bg-[#0A0A0B] flex flex-col shrink-0 h-[calc(100vh-4rem)] sticky top-16 overflow-y-auto select-none transition-colors">
      <nav className="flex-1 px-4 py-4 space-y-5">
        {navGroups.map((group, gIdx) => (
          <div key={gIdx} className="space-y-1">
            <div className="text-[10px] uppercase text-slate-400 dark:text-[#666] font-bold px-2.5 mb-1.5 tracking-widest">
              {group.group}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveView(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-all ${
                      isActive
                        ? 'bg-slate-100 dark:bg-[#1A1A1D] text-slate-900 dark:text-white border-l-2 border-[#F27D26] font-semibold'
                        : 'text-slate-600 dark:text-[#888] hover:bg-slate-50 dark:hover:bg-[#151518] hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-[#F27D26]' : 'text-slate-400 dark:text-[#666]'}`} />
                      <span className="text-sm">{item.label}</span>
                    </div>
                    {item.badge !== undefined && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${item.badgeColor || 'bg-slate-200 dark:bg-[#1F1F23] text-slate-800 dark:text-[#AAA]'}`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User info card matching Bento design aside */}
      <div className="p-4 border-t border-slate-200 dark:border-[#1F1F23]">
        <div className="flex items-center gap-3 px-2 py-1 text-slate-500 dark:text-[#666]">
          <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-[#333] flex items-center justify-center font-bold text-xs text-slate-700 dark:text-[#E0E0E0]">
            {currentUser?.name ? currentUser.name.charAt(0) : 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-800 dark:text-[#AAA] truncate">{currentUser?.name || 'Security Analyst'}</p>
            <p className="text-[10px] text-slate-400 dark:text-[#666] font-mono truncate">{currentUser?.role || 'stk-analyst'}</p>
          </div>
        </div>
      </div>
    </aside>
  );
};
