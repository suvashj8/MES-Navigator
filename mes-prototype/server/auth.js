import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from './db.js';
import { publicUser } from './scope.js';

const JWT_SECRET = process.env.JWT_SECRET || 'mes-prototype-secret-change-in-production';
const TOKEN_HOURS = 12;

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

export function seedDefaultUsers() {
  const count = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  if (count > 0) {
    db.prepare("UPDATE users SET department = 'Production' WHERE username = 'supervisor' AND department IS NULL").run();
    return;
  }

  const users = [
    { username: 'admin', password: 'admin123', role: 'admin', display_name: 'System Admin', department: null },
    { username: 'supervisor', password: 'super123', role: 'supervisor', display_name: 'Production Supervisor', department: 'Production' },
    { username: 'operator', password: 'oper123', role: 'operator', display_name: 'Floor Operator', department: null },
  ];

  const insert = db.prepare(
    'INSERT INTO users (username, password_hash, role, display_name, department) VALUES (?, ?, ?, ?, ?)'
  );
  for (const u of users) {
    insert.run(u.username, bcrypt.hashSync(u.password, 10), u.role, u.display_name, u.department);
  }
  console.log('Default users seeded (admin / supervisor / operator)');
}

export function login(username, password) {
  const user = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return null;
  }
  const payload = userPayload(user);
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: `${TOKEN_HOURS}h` });
  return { token, user: payload };
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export function refreshUserFromDb(jwtUser) {
  const row = db.prepare('SELECT * FROM users WHERE id = ? AND is_active = 1').get(jwtUser.id);
  return row ? userPayload(row) : jwtUser;
}
