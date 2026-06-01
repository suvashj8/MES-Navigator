import bcrypt from 'bcryptjs';
import { one, all, run } from '../db.js';
import { asyncHandler } from '../asyncHandler.js';
import { requirePermission } from '../middleware.js';
import { assertPersonName } from '../validateText.js';

export function registerUsersRoutes(app) {
app.get('/api/users', requirePermission('users:manage'), asyncHandler(async (_, res) => {
  res.json(
    await all('SELECT id, username, role, display_name, department, is_active FROM users ORDER BY username', [])
  );
}));

app.post('/api/users', requirePermission('users:manage'), asyncHandler(async (req, res) => {
  const { username, password, role, display_name, department } = req.body;
  if (!username || !password || !role || !display_name) {
    return res.status(400).json({ error: 'All fields required' });
  }
  if (!['operator', 'supervisor', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  if (role === 'supervisor' && !department) {
    return res.status(400).json({ error: 'Supervisors require a department' });
  }
  try {
    const r = await run(
      'INSERT INTO users (username, password_hash, role, display_name, department) VALUES (?, ?, ?, ?, ?)'
    , [username, bcrypt.hashSync(password, 10), role, display_name, department || null]);
    res.status(201).json(
      await one('SELECT id, username, role, display_name, department, is_active FROM users WHERE id = ?', [r.lastInsertRowid])
    );
  } catch (e) {
    res.status(400).json({ error: e.message.toLowerCase().includes('unique') ? 'Username already exists' : e.message });
  }
}));

app.patch('/api/users/:id', requirePermission('users:manage'), asyncHandler(async (req, res) => {
  const { role, display_name, is_active, password, department } = req.body;
  const existing = await one('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  if (Number(req.params.id) === req.user.id && is_active === 0) {
    return res.status(400).json({ error: 'Cannot deactivate your own account' });
  }
  if (password) {
    await run('UPDATE users SET password_hash = ? WHERE id = ?', [bcrypt.hashSync(password, 10), req.params.id]);
  }
  if (role != null) await run('UPDATE users SET role = ? WHERE id = ?', [role, req.params.id]);
  if (display_name != null) await run('UPDATE users SET display_name = ? WHERE id = ?', [display_name, req.params.id]);
  if (department !== undefined) await run('UPDATE users SET department = ? WHERE id = ?', [department || null, req.params.id]);
  if (is_active != null) await run('UPDATE users SET is_active = ? WHERE id = ?', [is_active ? 1 : 0, req.params.id]);
  res.json(
    await one('SELECT id, username, role, display_name, department, is_active FROM users WHERE id = ?', [req.params.id])
  );
}));
}
