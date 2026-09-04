import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { Organization, SubscriptionPlanDetails } from '../types';
import {
  Building2,
  Plus,
  Search,
  ShieldCheck,
  Users,
  Server,
  Mail,
  Globe,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

export const OrganizationsView: React.FC = () => {
  const { isSuperAdmin } = useAuth();
  const { refreshTrigger, addToast, setSelectedOrgId, setActiveView } = useApp();

  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlanDetails[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // New Organization Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgDomain, setNewOrgDomain] = useState('');
  const [newOrgEmail, setNewOrgEmail] = useState('');
  const [newOrgPlan, setNewOrgPlan] = useState('PNGEE_BUSINESS');
  const [newOrgAssets, setNewOrgAssets] = useState(50);

  const loadData = async () => {
    try {
      const [oData, pData] = await Promise.all([
        api.getOrganizations(),
        api.getPlans()
      ]);
      setOrgs(oData);
      setPlans(pData);
    } catch (err) {
      console.error('Failed to load organizations:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, [refreshTrigger]);

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await api.createOrganization({
        name: newOrgName,
        domain: newOrgDomain,
        contactEmail: newOrgEmail,
        plan: newOrgPlan as any,
        maxAssets: Number(newOrgAssets)
      });
      addToast('Organization Onboarded', `Created tenant "${created.name}" on ${created.plan} plan.`, 'success');
      setShowCreateModal(false);
      setNewOrgName('');
      setNewOrgDomain('');
      setNewOrgEmail('');
      loadData();
    } catch (err: any) {
      addToast('Onboarding Failed', err.message, 'error');
    }
  };

  const filteredOrgs = orgs.filter(o => {
    const q = (searchQuery || '').toLowerCase().trim();
    return !q ||
      (o.name && o.name.toLowerCase().includes(q)) ||
      (o.domain && o.domain.toLowerCase().includes(q)) ||
      (o.contactEmail && o.contactEmail.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Managed Customer Organizations & Multi-Tenancy
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            MSP Tenant roster, subscription tier allocations, asset quotas, and security boundaries
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {isSuperAdmin && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm shadow-blue-500/20 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Onboard New Customer</span>
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-2">
        <Search className="w-4 h-4 text-slate-400 ml-1" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search organizations by name, domain, contact email..."
          className="bg-transparent text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none w-full"
        />
      </div>

      {/* Organization Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredOrgs.map(org => {
          const planDetail = plans.find(p => p.id === org.plan);
          return (
            <div
              key={org.id}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                        {org.name}
                      </h3>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
                        <Globe className="w-3 h-3" />
                        <span>{org.domain}</span>
                      </div>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    org.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-500'
                  }`}>
                    {org.status}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Subscription Plan:</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">
                      {org.plan.replace('PNGEE_', '').replace('STK_', '')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Asset Quota:</span>
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                      Up to {org.maxAssets} devices
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Contact:</span>
                    <span className="text-slate-700 dark:text-slate-300 truncate max-w-[160px]">
                      {org.contactEmail}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action: Switch to this Tenant's Dashboard */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button
                  onClick={() => {
                    setSelectedOrgId(org.id);
                    setActiveView('dashboard');
                  }}
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  <span>Open Security Dashboard</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Onboard Organization Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Onboard Customer Organization
            </h2>
            <form onSubmit={handleCreateOrg} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">Company Name</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Horizon Financial Services"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">Primary Domain</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. horizonfin.com"
                  value={newOrgDomain}
                  onChange={(e) => setNewOrgDomain(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-mono"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">Primary Contact Email</label>
                <input
                  required
                  type="email"
                  placeholder="e.g. sec-admin@horizonfin.com"
                  value={newOrgEmail}
                  onChange={(e) => setNewOrgEmail(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Service Plan</label>
                  <select
                    value={newOrgPlan}
                    onChange={(e) => setNewOrgPlan(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2"
                  >
                    <option value="PNGEE_STARTER">Starter ($499/mo)</option>
                    <option value="PNGEE_BUSINESS">Business ($1,499/mo)</option>
                    <option value="PNGEE_ENTERPRISE">Enterprise ($3,499/mo)</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold block mb-1">Asset Quota</label>
                  <input
                    type="number"
                    value={newOrgAssets}
                    onChange={(e) => setNewOrgAssets(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg text-slate-500 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold"
                >
                  Onboard Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
