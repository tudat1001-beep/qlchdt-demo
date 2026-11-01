import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User, LoginCredentials } from '../types/auth';
import { api, ApiClientError } from '../lib/api-client';
import { idempotencyManager } from '../lib/idempotency';
import { queryClient } from '../lib/query-client';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshAuth = useCallback(async () => {
    try {
      const me = await api.get<User>('/auth/me');
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  const login = async (credentials: LoginCredentials) => {
    const loggedInUser = await api.post<User>('/auth/login', credentials, {
      skipIdempotency: true, // login does not require Idempotency-Key
    });
    setUser(loggedInUser);
  };

  const logout = async () => {
    // Only clear local user, query cache, and idempotency store after server confirms success!
    // If server logout fails (e.g. 500 or network), this throws and preserves session state.
    await api.post<{ ok: boolean }>('/auth/logout', {}, {
      skipIdempotency: true,
    });

    queryClient.clear();
    idempotencyManager.clear();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
