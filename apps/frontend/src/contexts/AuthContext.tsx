// ============================================================================
// CHATVISTA - Auth Context
// Authentication context provider
// ============================================================================

'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { authApi, getTokens, clearTokens, ApiError } from '@/lib/api';

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  name: string;
  avatar?: string;
  avatarUrl?: string;
  role: string;
  mfaEnabled?: boolean;
  organizationId?: string;
  organizationName?: string;
  createdAt?: string;
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
      // Map API user to our User interface
      const mappedUser: User = {
        id: userData.id,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        displayName: userData.displayName,
        name: userData.displayName || `${userData.firstName} ${userData.lastName}`.trim(),
        avatar: userData.avatarUrl,
        avatarUrl: userData.avatarUrl,
        role: userData.role,
        mfaEnabled: userData.mfaEnabled,
        organizationId: userData.organizationId,
        organizationName: userData.organizationName,
      };
      setUser(mappedUser);
    } catch (error: unknown) {
      // 401 is expected when not logged in - silently clear state
      const isUnauthorized = error instanceof ApiError && error.status === 401;
      
      if (!isUnauthorized) {
        console.error('Failed to refresh user:', error);
      }
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

    // Map API user to our User interface
    const userData: User = {
      id: result.user.id,
      email: result.user.email,
      firstName: result.user.firstName,
      lastName: result.user.lastName,
      displayName: result.user.displayName,
      name: result.user.displayName || `${result.user.firstName} ${result.user.lastName}`.trim(),
      avatar: result.user.avatarUrl,
      avatarUrl: result.user.avatarUrl,
      role: result.user.role,
      mfaEnabled: result.user.mfaEnabled,
      organizationId: result.user.organizationId,
      organizationName: result.user.organizationName,
    };
    setUser(userData);
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
