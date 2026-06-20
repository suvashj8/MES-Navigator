/** @typedef {import('cors').CorsOptions} CorsOptions */

import { loadDevPorts } from './lib/devPorts.js';

const DEV_UI_PORTS_FALLBACK = [5184, 5174, 5173, 5175, 5176];

const DEV_DEFAULT_ORIGINS = [
  'http://localhost:5184',
  'http://127.0.0.1:5184',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5175',
  'http://127.0.0.1:5175',
  'http://localhost:5176',
  'http://127.0.0.1:5176',
];

function parseOrigins(raw) {
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function devUiPorts() {
  try {
    const { ui } = loadDevPorts();
    return new Set([ui, ...DEV_UI_PORTS_FALLBACK]);
  } catch {
    return new Set(DEV_UI_PORTS_FALLBACK);
  }
}

/** RFC1918 + link-local — dev LAN testing (phone/tablet on same Wi‑Fi). */
function isPrivateLanHost(hostname) {
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
  const m = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const octets = m.slice(1).map(Number);
  if (octets.some((n) => n > 255)) return false;
  const [a, b] = octets;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

/** In dev, allow http(s) from any private LAN IP on configured UI port(s). */
function isDevLanOrigin(origin) {
  if (process.env.NODE_ENV === 'production') return false;
  try {
    const u = new URL(origin);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    const port = u.port ? Number(u.port) : u.protocol === 'https:' ? 443 : 80;
    if (!devUiPorts().has(port)) return false;
    return isPrivateLanHost(u.hostname);
  } catch {
    return false;
  }
}

/**
 * Build CORS options with an explicit origin whitelist (never `*`).
 * Production requires CORS_ORIGINS. Development merges defaults + env + LAN IPs.
 */
export function resolveCorsOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  const fromEnv = parseOrigins(process.env.CORS_ORIGINS);

  if (fromEnv.some((o) => o === '*')) {
    throw new Error('CORS_ORIGINS must not use "*". List explicit origins (e.g. https://mes.example.com).');
  }

  const allowed = new Set(isProd ? fromEnv : [...DEV_DEFAULT_ORIGINS, ...fromEnv]);

  if (isProd && allowed.size === 0) {
    throw new Error(
      'CORS_ORIGINS is required when NODE_ENV=production. Set comma-separated UI URLs (e.g. CORS_ORIGINS=https://mes.example.com).'
    );
  }

  return {
    origin(origin, callback) {
      // Same-origin, curl, Postman, or server-side calls (no Origin header).
      if (!origin) return callback(null, true);
      if (allowed.has(origin)) return callback(null, true);
      if (isDevLanOrigin(origin)) return callback(null, true);
      callback(new Error(`CORS blocked origin: ${origin}`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 204,
    maxAge: 86_400,
  };
}
