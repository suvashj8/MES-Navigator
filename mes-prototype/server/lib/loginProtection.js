/**
 * In-memory login brute-force protection (per server process).
 * Pair with express-rate-limit on POST /api/auth/login for defense in depth.
 */

const isProd = process.env.NODE_ENV === 'production';

const WINDOW_MS = Number(process.env.LOGIN_FAILURE_WINDOW_MS) || 15 * 60 * 1000;
const MAX_FAILURES = Number(process.env.LOGIN_LOCKOUT_MAX_FAILURES) || (isProd ? 5 : 20);
const LOCKOUT_MS = Number(process.env.LOGIN_LOCKOUT_DURATION_MS) || 15 * 60 * 1000;
const FAIL_DELAY_MS = Number(process.env.LOGIN_FAIL_DELAY_MS) || (isProd ? 750 : 200);

/** @type {Map<string, { failures: number[]; lockUntil: number }>} */
const buckets = new Map();

function pruneFailures(times) {
  const cutoff = Date.now() - WINDOW_MS;
  return times.filter((t) => t > cutoff);
}

function bucketKey(kind, ip, username) {
  const u = String(username || '').trim().toLowerCase();
  if (kind === 'ip') return `ip:${ip}`;
  return `acct:${ip}:${u}`;
}

function getBucket(key) {
  let b = buckets.get(key);
  if (!b) {
    b = { failures: [], lockUntil: 0 };
    buckets.set(key, b);
  }
  return b;
}

function isKeyLocked(key) {
  const b = getBucket(key);
  if (b.lockUntil > Date.now()) {
    return { locked: true, retryAfterMs: b.lockUntil - Date.now() };
  }
  b.failures = pruneFailures(b.failures);
  if (b.failures.length >= MAX_FAILURES) {
    b.lockUntil = Date.now() + LOCKOUT_MS;
    return { locked: true, retryAfterMs: LOCKOUT_MS };
  }
  return { locked: false, retryAfterMs: 0 };
}

export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

/** @returns {{ allowed: boolean; retryAfterSec?: number; message?: string }} */
export function checkLoginAllowed(ip, username) {
  for (const kind of ['ip', 'acct']) {
    const key = bucketKey(kind, ip, username);
    const { locked, retryAfterMs } = isKeyLocked(key);
    if (locked) {
      const retryAfterSec = Math.ceil(retryAfterMs / 1000);
      return {
        allowed: false,
        retryAfterSec,
        message: `Too many failed login attempts. Try again in ${retryAfterSec} seconds.`,
      };
    }
  }
  return { allowed: true };
}

export function recordLoginFailure(ip, username) {
  const now = Date.now();
  for (const kind of ['ip', 'acct']) {
    const key = bucketKey(kind, ip, username);
    const b = getBucket(key);
    b.failures = pruneFailures([...b.failures, now]);
    if (b.failures.length >= MAX_FAILURES) {
      b.lockUntil = now + LOCKOUT_MS;
    }
  }
}

export function recordLoginSuccess(ip, username) {
  const keys = [bucketKey('ip', ip, username), bucketKey('acct', ip, username)];
  for (const key of keys) {
    buckets.delete(key);
  }
}

export function failDelayMs() {
  return FAIL_DELAY_MS;
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
