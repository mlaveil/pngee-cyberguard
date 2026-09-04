import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { setApiAuthContext } from '../services/api';

export interface ToastNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
}

interface AppContextType {
  selectedOrgId: string;
  setSelectedOrgId: (orgId: string) => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  activeView: string;
  setActiveView: (view: string) => void;
  refreshTrigger: number;
  triggerRefresh: () => void;
  toasts: ToastNotification[];
  addToast: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  removeToast: (id: string) => void;
  isAiModalOpen: boolean;
  setIsAiModalOpen: (open: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [selectedOrgId, setSelectedOrgIdState] = useState<string>('all');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [activeView, setActiveView] = useState<string>('dashboard');
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  // Sync selected org with user role
  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === 'CUSTOMER_ADMIN' || currentUser.role === 'CUSTOMER_USER') {
        setSelectedOrgIdState(currentUser.organizationId);
        setApiAuthContext(currentUser.id, currentUser.organizationId);
      } else {
        // Default to 'all' or keep current for PNGee IT Solutions staff
        setApiAuthContext(currentUser.id, selectedOrgId);
      }
    }
  }, [currentUser, selectedOrgId]);

  // Handle Theme
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const setSelectedOrgId = (orgId: string) => {
    setSelectedOrgIdState(orgId);
    if (currentUser) {
      setApiAuthContext(currentUser.id, orgId);
    }
    triggerRefresh();
  };

  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const addToast = (title: string, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
    setToasts(prev => [...prev, { id, title, message, type, timestamp: new Date().toLocaleTimeString() }]);
    
    setTimeout(() => {
      removeToast(id);
    }, 5000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <AppContext.Provider
      value={{
        selectedOrgId,
        setSelectedOrgId,
        theme,
        toggleTheme,
        activeView,
        setActiveView,
        refreshTrigger,
        triggerRefresh,
        toasts,
        addToast,
        removeToast,
        isAiModalOpen,
        setIsAiModalOpen,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
