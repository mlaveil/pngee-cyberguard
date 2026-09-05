import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Organization } from '../types';
import { api, LoginResult, setApiAuthContext } from '../services/api';

interface AuthContextType {
  currentUser: User | null;
  currentOrg: Organization | null;
  availableOrgs: Organization[];
  allDemoUsers: User[];
  isLoading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  verifyMfa: (mfaChallenge: string, code?: string, recoveryCode?: string) => Promise<{ user: User; accessToken: string }>;
  logout: () => Promise<void>;
  switchUser: (userId: string) => Promise<void>;
  refreshAuth: () => Promise<void>;
  isSuperAdmin: boolean;
  isSecAnalyst: boolean;
  isCustomerAdmin: boolean;
  isCustomerUser: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [availableOrgs, setAvailableOrgs] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const applyAuth = (user: User, organization: Organization | null, orgs: Organization[] = []) => {
    setCurrentUser(user); setCurrentOrg(organization); setAvailableOrgs(orgs);
    setApiAuthContext(undefined, ['PNGEE_SUPER_ADMIN','PNGEE_SECURITY_ANALYST','STK_SUPER_ADMIN','STK_SECURITY_ANALYST'].includes(user.role) ? 'all' : user.organizationId);
  };

  const refreshAuth = async () => {
    try { const data = await api.getMe(); applyAuth(data.user, data.organization, data.availableOrgs || []); }
    catch { setCurrentUser(null); setCurrentOrg(null); setAvailableOrgs([]); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { refreshAuth(); }, []);

  const login = async (email: string, password: string): Promise<LoginResult> => {
    setIsLoading(true);
    try {
      const data = await api.login(email, password);
      if (data.accessToken) {
        const me = await api.getMe();
        applyAuth(me.user, me.organization, me.availableOrgs || []);
      }
      return data;
    } finally { setIsLoading(false); }
  };

  const verifyMfa = async (mfaChallenge: string, code?: string, recoveryCode?: string) => {
    const data = await api.verifyMfa(mfaChallenge, code, recoveryCode);
    const me = await api.getMe();
    applyAuth(me.user, me.organization, me.availableOrgs || []);
    return data;
  };

  const logout = async () => { await api.logout(); setCurrentUser(null); setCurrentOrg(null); setAvailableOrgs([]); };

  const switchUser = async (_userId: string) => { throw new Error('User switching is disabled. Use a real account with the required role.'); };

  const isSuperAdmin = currentUser?.role === 'PNGEE_SUPER_ADMIN' || currentUser?.role === 'STK_SUPER_ADMIN';
  const isSecAnalyst = currentUser?.role === 'PNGEE_SECURITY_ANALYST' || currentUser?.role === 'STK_SECURITY_ANALYST';
  const isCustomerAdmin = currentUser?.role === 'CUSTOMER_ADMIN';
  const isCustomerUser = currentUser?.role === 'CUSTOMER_USER';

  return <AuthContext.Provider value={{ currentUser, currentOrg, availableOrgs, allDemoUsers: [], isLoading, login, verifyMfa, logout, switchUser, refreshAuth, isSuperAdmin, isSecAnalyst, isCustomerAdmin, isCustomerUser }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
