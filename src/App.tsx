import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider, useApp } from './context/AppContext';
import { LoginScreen } from './components/auth/LoginScreen';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { AiCopilotModal } from './components/modals/AiCopilotModal';
import { TelemetrySimulatorModal } from './components/modals/TelemetrySimulatorModal';
import { DashboardView } from './views/DashboardView'; import { AssetsView } from './views/AssetsView'; import { MonitoringView } from './views/MonitoringView'; import { AlertsIncidentsView } from './views/AlertsIncidentsView'; import { VulnerabilitiesView } from './views/VulnerabilitiesView'; import { SpecializedModulesView } from './views/SpecializedModulesView'; import { ThreatIntelView } from './views/ThreatIntelView'; import { ReportsView } from './views/ReportsView'; import { OrganizationsView } from './views/OrganizationsView'; import { UsersView } from './views/UsersView'; import { IntegrationsView } from './views/IntegrationsView'; import { AuditLogsView } from './views/AuditLogsView'; import { TestRunnerView } from './views/TestRunnerView'; import { SystemHealthView } from './views/SystemHealthView';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

const MainLayout: React.FC = () => {
  const { activeView, isAiModalOpen, setIsAiModalOpen, toasts, removeToast } = useApp(); const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const renderActiveView = () => { switch (activeView) {
    case 'dashboard': return <DashboardView onOpenSimulator={() => setIsSimulatorOpen(true)} />; case 'assets': return <AssetsView />; case 'monitoring': return <MonitoringView onOpenSimulator={() => setIsSimulatorOpen(true)} />; case 'alerts': case 'incidents': return <AlertsIncidentsView />; case 'vulnerabilities': return <VulnerabilitiesView />; case 'specialized': return <SpecializedModulesView />; case 'threat-intel': return <ThreatIntelView />; case 'reports': return <ReportsView />; case 'organizations': return <OrganizationsView />; case 'users': return <UsersView />; case 'integrations': return <IntegrationsView />; case 'audit-logs': return <AuditLogsView />; case 'system-health': return <SystemHealthView />; case 'tests': return <TestRunnerView />; default: return <DashboardView onOpenSimulator={() => setIsSimulatorOpen(true)} />;
  }};
  return <div className="min-h-screen bg-slate-100 dark:bg-[#050505] text-slate-900 dark:text-[#E0E0E0] flex flex-col font-sans"><Navbar onOpenTelemetrySimulator={() => setIsSimulatorOpen(true)} /><div className="flex-1 flex overflow-hidden"><Sidebar /><main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 max-w-[1600px] w-full mx-auto">{renderActiveView()}</main></div><AiCopilotModal isOpen={isAiModalOpen} onClose={() => setIsAiModalOpen(false)} /><TelemetrySimulatorModal isOpen={isSimulatorOpen} onClose={() => setIsSimulatorOpen(false)} /><div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-md w-full pointer-events-none">{toasts.map(toast => <div key={toast.id} className="pointer-events-auto p-3.5 rounded-xl border shadow-lg flex items-start gap-3 bg-white dark:bg-slate-900"><div className="flex-1 text-xs"><div className="font-bold">{toast.title}</div><div className="text-slate-500 mt-0.5">{toast.message}</div></div><button onClick={() => removeToast(toast.id)}><X className="w-4 h-4" /></button></div>)}</div></div>;
};

const AuthGate: React.FC = () => { const { currentUser, isLoading } = useAuth(); if (isLoading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">Loading secure session…</div>; if (!currentUser) return <LoginScreen />; return <AppProvider><MainLayout /></AppProvider>; };

export default function App() { return <AuthProvider><AuthGate /></AuthProvider>; }
