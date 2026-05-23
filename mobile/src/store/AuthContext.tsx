import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { setApiTokenGetter, setUnauthorizedHandler } from '../services/api';
import { disconnectSocket, refreshSocketAuth, setSocketTokenGetter } from '../services/socket';
import type { User } from '../types';

const TOKEN_KEY = 'syncrova.nativeMessenger.token';

type AuthContextValue = {
  user: User | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const getToken = useCallback(async () => token || AsyncStorage.getItem(TOKEN_KEY), [token]);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem(TOKEN_KEY);
    disconnectSocket();
    setToken(null);
    setUser(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    const res = await api.get<User>('/users/profile');
    setUser(res.data || null);
  }, []);

  useEffect(() => {
    setApiTokenGetter(getToken);
    setSocketTokenGetter(getToken);
    setUnauthorizedHandler(() => {
      logout().catch(() => {});
    });
  }, [getToken, logout]);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        const storedToken = await AsyncStorage.getItem(TOKEN_KEY);
        if (!storedToken) return;
        setToken(storedToken);
        const res = await api.get<User>('/users/profile');
        if (!cancelled) setUser(res.data || null);
      } catch {
        await AsyncStorage.removeItem(TOKEN_KEY);
        if (!cancelled) {
          setToken(null);
          setUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<{ token: string; user: User }>('/auth/login', { email, password });
    await AsyncStorage.setItem(TOKEN_KEY, res.data.token);
    setToken(res.data.token);
    setUser(res.data.user);
    await refreshSocketAuth({ reconnect: true });
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    token,
    loading,
    isAuthenticated: Boolean(user && token),
    login,
    logout,
    refreshProfile
  }), [loading, login, logout, refreshProfile, token, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
};
