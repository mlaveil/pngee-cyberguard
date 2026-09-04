import React, { useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { AiCopilotModal } from './components/modals/AiCopilotModal';
import { TelemetrySimulatorModal } from './components/modals/TelemetrySimulatorModal';

// Views
import { DashboardView } from './views/DashboardView';
import { AssetsView } from './views/AssetsView';
import { MonitoringView } from './views/MonitoringView';
import { AlertsIncidentsView } from './views/AlertsIncidentsView';
import { VulnerabilitiesView } from './views/VulnerabilitiesView';
import { SpecializedModulesView } from './views/SpecializedModulesView';
import { ThreatIntelView } from './views/ThreatIntelView';
import { ReportsView } from './views/ReportsView';
import { OrganizationsView } from './views/OrganizationsView';
import { UsersView } from './views/UsersView';
import { IntegrationsView } from './views/IntegrationsView';
import { AuditLogsView } from './views/AuditLogsView';
import { TestRunnerView } from './views/TestRunnerView';
import { SystemHealthView } from './views/SystemHealthView';

import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

const MainLayout: React.FC = () => {
  const { activeView, isAiModalOpen, setIsAiModalOpen, toasts, removeToast } = useApp();
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);

  const renderActiveView = () => {
    switch (activeView) {
      case 'dashboard':
        return <DashboardView onOpenSimulator={() => setIsSimulatorOpen(true)} />;
      case 'assets':
        return <AssetsView />;
      case 'monitoring':
        return <MonitoringView onOpenSimulator={() => setIsSimulatorOpen(true)} />;
      case 'alerts':
      case 'incidents':
        return <AlertsIncidentsView />;
      case 'vulnerabilities':
        return <VulnerabilitiesView />;
      case 'specialized':
        return <SpecializedModulesView />;
      case 'threat-intel':
        return <ThreatIntelView />;
      case 'reports':
        return <ReportsView />;
      case 'organizations':
        return <OrganizationsView />;
      case 'users':
        return <UsersView />;
      case 'integrations':
        return <IntegrationsView />;
      case 'audit-logs':
        return <AuditLogsView />;
      case 'system-health':
        return <SystemHealthView />;
      case 'tests':
        return <TestRunnerView />;
      default:
        return <DashboardView onOpenSimulator={() => setIsSimulatorOpen(true)} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#050505] text-slate-900 dark:text-[#E0E0E0] flex flex-col font-sans transition-colors">
      {/* Top Navbar */}
      <Navbar onOpenTelemetrySimulator={() => setIsSimulatorOpen(true)} />

      {/* Body: Sidebar + Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Navigation */}
        <Sidebar />

        {/* Dynamic Main Workspace */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 max-w-[1600px] w-full mx-auto">
          {renderActiveView()}
        </main>
      </div>

      {/* Global AI SOC Copilot Modal */}
      <AiCopilotModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
      />

      {/* Global Attack Telemetry Simulator Modal */}
      <TelemetrySimulatorModal
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
      />

      {/* Toast Notification Container */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-md w-full pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`pointer-events-auto p-3.5 rounded-xl border shadow-lg flex items-start gap-3 transition-all animate-fadeIn ${
              toast.type === 'success' ? 'bg-white dark:bg-slate-900 border-emerald-500/30 text-slate-900 dark:text-white' :
              toast.type === 'error' ? 'bg-white dark:bg-slate-900 border-rose-500/30 text-slate-900 dark:text-white' :
              'bg-white dark:bg-slate-900 border-blue-500/30 text-slate-900 dark:text-white'
            }`}
          >
            {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />}
            {toast.type === 'error' && <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />}
            {toast.type === 'info' && <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />}
            <div className="flex-1 text-xs">
              <div className="font-bold">{toast.title}</div>
              <div className="text-slate-500 dark:text-slate-400 mt-0.5">{toast.message}</div>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <MainLayout />
      </AppProvider>
    </AuthProvider>
  );
}
