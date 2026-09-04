import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { User, UserRole } from '../types';
import {
  Users,
  Plus,
  Search,
  KeyRound,
  Shield,
  CheckCircle2,
  XCircle,
  Mail
} from 'lucide-react';

export const UsersView: React.FC = () => {
  const { isSuperAdmin, isCustomerAdmin, currentOrg } = useAuth();
  const { selectedOrgId, refreshTrigger, addToast } = useApp();

  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddUserModal, setShowAddUserModal] = useState(false);

  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState<UserRole>('CUSTOMER_USER');

  const loadUsers = async () => {
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [selectedOrgId, refreshTrigger]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await api.createUser({
        name: userName,
        email: userEmail,
        role: userRole
      });
      addToast('User Added', `Created account for ${created.name} (${created.role}).`, 'success');
      setShowAddUserModal(false);
      setUserName('');
      setUserEmail('');
      loadUsers();
    } catch (err: any) {
      addToast('User Creation Failed', err.message, 'error');
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'PNGEE_SUPER_ADMIN':
      case 'STK_SUPER_ADMIN':
        return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20';
      case 'PNGEE_SECURITY_ANALYST':
      case 'STK_SECURITY_ANALYST':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20';
      case 'CUSTOMER_ADMIN':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
      case 'CUSTOMER_USER':
      default:
        return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20';
    }
  };

  const filteredUsers = users.filter(u => {
    const q = (searchQuery || '').toLowerCase().trim();
    return !q ||
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.role && u.role.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            User Directory & Role-Based Access Control (RBAC)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage organization members, security analysts, MFA requirements, and tenant privilege boundaries
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {(isSuperAdmin || isCustomerAdmin) && (
            <button
              onClick={() => setShowAddUserModal(true)}
              className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm shadow-blue-500/20 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Member</span>
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
          placeholder="Search users by name, email, or role..."
          className="bg-transparent text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none w-full"
        />
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">User Name & Email</th>
                <th className="px-4 py-3">Tenant Organization</th>
                <th className="px-4 py-3">Assigned Role</th>
                <th className="px-4 py-3">MFA Status</th>
                <th className="px-4 py-3">Account Status</th>
                <th className="px-4 py-3">Joined Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredUsers.map(user => (
                <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="font-bold text-slate-900 dark:text-white text-xs">{user.name}</div>
                    <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      <span>{user.email}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-300 text-[11px]">
                    {user.organizationId}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${getRoleBadge(user.role)}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${user.mfaEnabled ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {user.mfaEnabled ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                      {user.mfaEnabled ? 'Enforced' : 'Not Set'}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                      user.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-500'
                    }`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-[11px] whitespace-nowrap">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Create New User Account
            </h2>
            <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">Full Name</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Rachel Adams"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">Email Address</label>
                <input
                  required
                  type="email"
                  placeholder="e.g. rachel@apexlogistics.com"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-mono"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">Assigned Role & Permissions</label>
                <select
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2"
                >
                  <option value="CUSTOMER_USER">Customer User (Read-Only Organization View)</option>
                  <option value="CUSTOMER_ADMIN">Customer Administrator (Full Org Management)</option>
                  {isSuperAdmin && (
                    <>
                      <option value="PNGEE_SECURITY_ANALYST">PNGee Security Analyst (SOC Operator)</option>
                      <option value="PNGEE_SUPER_ADMIN">PNGee Super Admin (Full Platform Master)</option>
                    </>
                  )}
                </select>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 rounded-lg text-slate-500 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold"
                >
                  Add User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
