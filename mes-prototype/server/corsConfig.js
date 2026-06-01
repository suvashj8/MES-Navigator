/** @typedef {import('cors').CorsOptions} CorsOptions */

const DEV_DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
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

/**
 * Build CORS options with an explicit origin whitelist (never `*`).
 * Production requires CORS_ORIGINS. Development merges defaults + env.
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
      callback(new Error(`CORS blocked origin: ${origin}`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 204,
    maxAge: 86_400,
  };
}
