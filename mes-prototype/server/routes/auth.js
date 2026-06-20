import bcrypt from 'bcryptjs';
import { run, one } from '../db.js';
import { asyncHandler } from '../asyncHandler.js';
import { requireAuth } from '../middleware.js';
import { resolveDepartment } from '../scope.js';
import { loginIpRateLimit } from '../middleware/loginRateLimit.js';
import { loginHandler } from '../middleware/loginGuard.js';
import { refreshHandler } from '../middleware/refreshGuard.js';

export function registerPublicAuthRoutes(app) {
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });
  app.post('/api/auth/login', loginIpRateLimit, asyncHandler(loginHandler));
  app.post('/api/auth/refresh', asyncHandler(refreshHandler));
}

export function registerAuthUserRoutes(app) {
  app.get('/api/auth/me', requireAuth, asyncHandler(async (req, res) => {
    res.json({ user: req.user });
  }));

  app.patch('/api/auth/profile', requireAuth, asyncHandler(async (req, res) => {
    const { password, display_name } = req.body;
    if (display_name) {
      await run('UPDATE users SET display_name = ? WHERE id = ?', [display_name, req.user.id]);
    }
    if (password) {
      if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
      await run('UPDATE users SET password_hash = ? WHERE id = ?', [bcrypt.hashSync(password, 10), req.user.id]);
    }
    const user = await one('SELECT id, username, role, display_name FROM users WHERE id = ?', [req.user.id]);
    res.json({ user: { id: user.id, username: user.username, role: user.role, display_name: user.display_name } });
  }));
}

export function registerAuthScopeRoutes(app) {
  app.get('/api/auth/scope', asyncHandler(async (req, res) => {
    const scope = resolveDepartment(req, req.query.department);
    res.json(scope);
  }));
}
