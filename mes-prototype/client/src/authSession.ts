import type { User } from './api';

export type AuthSession = {
  token: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn?: number;
  user: User;
};

export const TOKEN_KEY = 'mes_token';
export const REFRESH_KEY = 'mes_refresh_token';
export const EXPIRES_KEY = 'mes_token_expires_at';
export const LOGIN_MESSAGE_KEY = 'mes_login_message';

const WARN_BEFORE_MS = 5 * 60 * 1000;

export function persistAuthSession(session: AuthSession) {
  localStorage.setItem(TOKEN_KEY, session.token);
  localStorage.setItem(REFRESH_KEY, session.refreshToken);
  localStorage.setItem(EXPIRES_KEY, String(Date.now() + session.expiresIn * 1000));
}

export function clearAuthSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(EXPIRES_KEY);
}

export function getAccessExpiresAt(): number | null {
  const raw = localStorage.getItem(EXPIRES_KEY);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function msUntilAccessExpiry(): number | null {
  const exp = getAccessExpiresAt();
  if (!exp) return null;
  return exp - Date.now();
}

export function shouldWarnSessionExpiry(): boolean {
  const ms = msUntilAccessExpiry();
  return ms != null && ms > 0 && ms <= WARN_BEFORE_MS;
}

export function formatExpiryCountdown(ms: number): string {
  if (ms <= 0) return 'less than a minute';
  const min = Math.ceil(ms / 60_000);
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'}`;
  const h = Math.floor(min / 60);
  const rem = min % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h} hour${h === 1 ? '' : 's'}`;
}

export function redirectToLogin(message: string) {
  sessionStorage.setItem(LOGIN_MESSAGE_KEY, message);
  clearAuthSession();
  if (!window.location.pathname.startsWith('/login')) {
    window.location.href = '/login';
  }
}

export async function fetchRefreshSession(): Promise<AuthSession | null> {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return null;

  const res = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) return null;
  return res.json() as Promise<AuthSession>;
}

let refreshInFlight: Promise<AuthSession | null> | null = null;

/** Single-flight refresh used by API 401 handler and session timers. */
export function refreshSessionOnce(): Promise<AuthSession | null> {
  if (!refreshInFlight) {
    refreshInFlight = fetchRefreshSession().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export function consumeLoginMessage(): string | null {
  const msg = sessionStorage.getItem(LOGIN_MESSAGE_KEY);
  if (msg) sessionStorage.removeItem(LOGIN_MESSAGE_KEY);
  return msg;
}
