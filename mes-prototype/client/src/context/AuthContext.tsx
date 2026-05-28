import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, setAuthToken, type User } from '../api';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  can: (permission: string) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

const ROLE_PERMISSIONS: Record<string, string[]> = {
  operator: ['daily-grading:write', 'standards:read', 'reports:read'],
  supervisor: ['daily-grading:write', 'daily-grading:delete', 'standards:read', 'standards:write', 'reports:read'],
  admin: ['daily-grading:write', 'daily-grading:delete', 'standards:read', 'standards:write', 'activity-mapping:write', 'reports:read', 'staff:write', 'users:manage'],
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('mes_token');
    if (!token) {
      setLoading(false);
      return;
    }
    setAuthToken(token);
    api.me().then((r) => setUser(r.user)).catch(() => {
      localStorage.removeItem('mes_token');
      setAuthToken(null);
    }).finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const { token, user: u } = await api.login(username, password);
    localStorage.setItem('mes_token', token);
    setAuthToken(token);
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('mes_token');
    setAuthToken(null);
    setUser(null);
  }, []);

  const can = useCallback(
    (permission: string) => {
      if (!user) return false;
      return (ROLE_PERMISSIONS[user.role] || []).includes(permission);
    },
    [user]
  );

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
