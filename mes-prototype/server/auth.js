import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { one, run } from './db.js';

const WEAK_JWT_SECRETS = new Set([
  'mes-prototype-secret-change-in-production',
  'your-secret-key-here',
  'change-me',
  'secret',
]);

/** Required — server refuses to start without a strong JWT_SECRET. */
export function resolveJwtSecret() {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    throw new Error(
      'JWT_SECRET is required. Copy server/.env.example to server/.env and set a random secret (e.g. run: openssl rand -base64 32).'
    );
  }
  if (secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters. Generate one with: openssl rand -base64 32');
  }
  if (WEAK_JWT_SECRETS.has(secret)) {
    throw new Error(
      'JWT_SECRET must not use a placeholder from .env.example. Generate a unique value (openssl rand -base64 32).'
    );
  }
  return secret;
}

const JWT_SECRET = resolveJwtSecret();
const ACCESS_TOKEN_HOURS = Number(process.env.ACCESS_TOKEN_HOURS) || 12;
const REFRESH_TOKEN_DAYS = Number(process.env.REFRESH_TOKEN_DAYS) || 7;
const ACCESS_TOKEN_SEC = ACCESS_TOKEN_HOURS * 60 * 60;
const REFRESH_TOKEN_SEC = REFRESH_TOKEN_DAYS * 24 * 60 * 60;

export const ROLES = ['operator', 'supervisor', 'admin'];

export const PERMISSIONS = {
  'daily-grading:write': ['operator', 'supervisor', 'admin'],
  'daily-grading:delete': ['supervisor', 'admin'],
  'standards:read': ['operator', 'supervisor', 'admin'],
  'standards:write': ['supervisor', 'admin'],
  'activity-mapping:write': ['admin'],
  'reports:read': ['operator', 'supervisor', 'admin'],
  'staff:write': ['admin'],
  'users:manage': ['admin'],
};

export function can(role, permission) {
  const allowed = PERMISSIONS[permission];
  return allowed ? allowed.includes(role) : false;
}

function userPayload(row) {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    display_name: row.display_name,
    department: row.department || null,
  };
}

export async function seedDefaultUsers() {
  const countRow = await one('SELECT COUNT(*)::int AS c FROM users');
  const count = countRow?.c ?? 0;
  if (count > 0) {
    await run(
      "UPDATE users SET department = 'Production' WHERE username = 'supervisor' AND department IS NULL"
    );
    return;
  }

  const users = [
    { username: 'admin', password: 'admin123', role: 'admin', display_name: 'System Admin', department: null },
    { username: 'supervisor', password: 'super123', role: 'supervisor', display_name: 'Production Supervisor', department: 'Production' },
    { username: 'operator', password: 'oper123', role: 'operator', display_name: 'Floor Operator', department: null },
  ];

  for (const u of users) {
    await run(
      'INSERT INTO users (username, password_hash, role, display_name, department) VALUES (?, ?, ?, ?, ?)',
      [u.username, bcrypt.hashSync(u.password, 10), u.role, u.display_name, u.department]
    );
  }
  console.log('Default users seeded (admin / supervisor / operator)');
}

function signAccessToken(user) {
  return jwt.sign({ ...user, typ: 'access' }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_SEC });
}

function signRefreshToken(userId) {
  return jwt.sign({ sub: userId, typ: 'refresh' }, JWT_SECRET, { expiresIn: REFRESH_TOKEN_SEC });
}

export function issueAuthSession(user) {
  return {
    token: signAccessToken(user),
    refreshToken: signRefreshToken(user.id),
    expiresIn: ACCESS_TOKEN_SEC,
    refreshExpiresIn: REFRESH_TOKEN_SEC,
    user,
  };
}

export async function login(username, password) {
  const user = await one('SELECT * FROM users WHERE username = ? AND is_active = 1', [username]);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return null;
  }
  return issueAuthSession(userPayload(user));
}

/** Exchange a valid refresh token for a new access + refresh pair (rotation). */
export async function refreshAuthSession(refreshToken) {
  let decoded;
  try {
    decoded = jwt.verify(refreshToken, JWT_SECRET);
  } catch {
    return null;
  }
  if (decoded.typ !== 'refresh' || !decoded.sub) return null;

  const row = await one('SELECT * FROM users WHERE id = ? AND is_active = 1', [decoded.sub]);
  if (!row) return null;
  return issueAuthSession(userPayload(row));
}

function stripJwtMeta(payload) {
  const { typ, iat, exp, sub, ...rest } = payload;
  return rest;
}

/** Verify access JWT only (not refresh tokens). */
export function verifyToken(token) {
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.typ === 'refresh') return null;
    if (payload.typ && payload.typ !== 'access') return null;
    return stripJwtMeta(payload);
  } catch {
    return null;
  }
}

export async function refreshUserFromDb(jwtUser) {
  const row = await one('SELECT * FROM users WHERE id = ? AND is_active = 1', [jwtUser.id]);
  return row ? userPayload(row) : jwtUser;
}
