import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Organization } from '../types';
import { api, setApiAuthContext } from '../services/api';

interface AuthContextType {
  currentUser: User | null;
  currentOrg: Organization | null;
  availableOrgs: Organization[];
  allDemoUsers: User[];
  isLoading: boolean;
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
  const [allDemoUsers, setAllDemoUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshAuth = async () => {
    try {
      setIsLoading(true);
      const data = await api.getMe();
      setCurrentUser(data.user);
      setCurrentOrg(data.organization);
      setAvailableOrgs(data.availableOrgs || []);

      // Also load all users for the role-switcher tool
      const users = await api.getUsers();
      setAllDemoUsers(users);
    } catch (err) {
      console.error('Failed to load auth context:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshAuth();
  }, []);

  const switchUser = async (userId: string) => {
    try {
      setIsLoading(true);
      const res = await api.switchUser(userId);
      setCurrentUser(res.user);
      setCurrentOrg(res.organization);
      
      // Update global API client auth header
      const orgFilter = (res.user.role === 'PNGEE_SUPER_ADMIN' || res.user.role === 'PNGEE_SECURITY_ANALYST' || res.user.role === 'STK_SUPER_ADMIN' || res.user.role === 'STK_SECURITY_ANALYST') ? 'all' : res.user.organizationId;
      setApiAuthContext(res.user.id, orgFilter);

      const refreshed = await api.getMe();
      setAvailableOrgs(refreshed.availableOrgs || []);
    } catch (err) {
      console.error('Failed to switch user:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const isSuperAdmin = currentUser?.role === 'PNGEE_SUPER_ADMIN' || currentUser?.role === 'STK_SUPER_ADMIN';
  const isSecAnalyst = currentUser?.role === 'PNGEE_SECURITY_ANALYST' || currentUser?.role === 'STK_SECURITY_ANALYST';
  const isCustomerAdmin = currentUser?.role === 'CUSTOMER_ADMIN';
  const isCustomerUser = currentUser?.role === 'CUSTOMER_USER';

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        currentOrg,
        availableOrgs,
        allDemoUsers,
        isLoading,
        switchUser,
        refreshAuth,
        isSuperAdmin,
        isSecAnalyst,
        isCustomerAdmin,
        isCustomerUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
