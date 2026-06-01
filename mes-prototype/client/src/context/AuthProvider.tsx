import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { api, setAuthToken, type User } from '../api';
import {
  clearAuthSession,
  formatExpiryCountdown,
  msUntilAccessExpiry,
  persistAuthSession,
  redirectToLogin,
  refreshSessionOnce,
  REFRESH_KEY,
  shouldWarnSessionExpiry,
  TOKEN_KEY,
  type AuthSession,
} from '../authSession';
import { AuthContext } from './auth-context';

/** Keep in sync with server/auth.js PERMISSIONS when roles change. */
const ROLE_PERMISSIONS: Record<string, string[]> = {
  operator: ['daily-grading:write', 'standards:read', 'reports:read'],
  supervisor: [
    'daily-grading:write',
    'daily-grading:delete',
    'standards:read',
    'standards:write',
    'reports:read',
  ],
  admin: [
    'daily-grading:write',
    'daily-grading:delete',
    'standards:read',
    'standards:write',
    'activity-mapping:write',
    'reports:read',
    'staff:write',
    'users:manage',
  ],
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionWarning, setSessionWarning] = useState<string | null>(null);
  const [renewingSession, setRenewingSession] = useState(false);

  const applySession = useCallback((session: AuthSession) => {
    persistAuthSession(session);
    setAuthToken(session.token);
    setUser(session.user);
    setSessionWarning(null);
  }, []);

  const renewSession = useCallback(async () => {
    setRenewingSession(true);
    try {
      const session = await refreshSessionOnce();
      if (!session) {
        redirectToLogin('Could not renew your session. Please sign in again.');
        setAuthToken(null);
        setUser(null);
        return false;
      }
      applySession(session);
      return true;
    } finally {
      setRenewingSession(false);
    }
  }, [applySession]);

  useEffect(() => {
    async function bootstrap() {
      const token = localStorage.getItem(TOKEN_KEY);
      const refresh = localStorage.getItem(REFRESH_KEY);
      if (!token && !refresh) {
        setLoading(false);
        return;
      }

      if (token) setAuthToken(token);

      const msLeft = msUntilAccessExpiry();
      if ((!token || msLeft == null || msLeft <= 0) && refresh) {
        const session = await refreshSessionOnce();
        if (session) applySession(session);
        else {
          clearAuthSession();
          setAuthToken(null);
          setLoading(false);
          return;
        }
      }

      try {
        const r = await api.me();
        setUser(r.user);
      } catch {
        const session = await refreshSessionOnce();
        if (session) {
          applySession(session);
          try {
            const r = await api.me();
            setUser(r.user);
          } catch {
            clearAuthSession();
            setAuthToken(null);
          }
        } else {
          clearAuthSession();
          setAuthToken(null);
        }
      } finally {
        setLoading(false);
      }
    }
    bootstrap();
  }, [applySession]);

  useEffect(() => {
    if (!user) {
      setSessionWarning(null);
      return;
    }

    const tick = () => {
      const ms = msUntilAccessExpiry();
      if (ms == null) return;

      if (ms <= 0) {
        setSessionWarning('Your session has expired. Click “Stay signed in” to continue.');
        return;
      }

      if (shouldWarnSessionExpiry()) {
        setSessionWarning(`Your session expires in ${formatExpiryCountdown(ms)}. Click “Stay signed in” to continue.`);
      } else {
        setSessionWarning(null);
      }
    };

    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [user]);

  const login = useCallback(
    async (username: string, password: string) => {
      const session = await api.login(username, password);
      applySession(session);
    },
    [applySession]
  );

  const logout = useCallback(() => {
    clearAuthSession();
    setAuthToken(null);
    setUser(null);
    setSessionWarning(null);
  }, []);

  const can = useCallback(
    (permission: string) => {
      if (!user) return false;
      return (ROLE_PERMISSIONS[user.role] || []).includes(permission);
    },
    [user]
  );

  return (
    <AuthContext.Provider
      value={{ user, loading, sessionWarning, renewingSession, login, logout, renewSession, can }}
    >
      {children}
    </AuthContext.Provider>
  );
}
