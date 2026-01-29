// ============================================================================
// CHATVISTA - Auth Context
// Authentication context provider
// ============================================================================

'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { authApi, getTokens, clearTokens } from '@/lib/api';

interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: string;
  mfaEnabled: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ requiresMfa?: boolean; mfaToken?: string }>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  verifyMfa: (mfaToken: string, code: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const { accessToken } = getTokens();
      if (!accessToken) {
        setUser(null);
        return;
      }

      const userData = await authApi.getProfile();
      setUser(userData);
    } catch (error) {
      console.error('Failed to refresh user:', error);
      setUser(null);
      clearTokens();
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true);
      await refreshUser();
      setIsLoading(false);
    };

    initAuth();
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    const result = await authApi.login({ email, password });

    if (result.requiresMfa) {
      return { requiresMfa: true, mfaToken: result.mfaToken };
    }

    setUser(result.user);
    return {};
  };

  const register = async (name: string, email: string, password: string) => {
    const result = await authApi.register({ name, email, password });
    setUser(result.user);
  };

  const logout = async () => {
    await authApi.logout();
    setUser(null);
    router.push('/login');
  };

  const verifyMfa = async (mfaToken: string, code: string) => {
    const result = await authApi.verifyMfa({ mfaToken, code });
    setUser(result.user);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        verifyMfa,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
