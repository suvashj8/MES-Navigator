import { all, one, run } from '../db.js';
import { asyncHandler } from '../asyncHandler.js';
import { requirePermission } from '../middleware.js';
import { resolveDepartment } from '../scope.js';
import {
  normalizeDepartmentCode,
  normalizeDepartmentName,
  syncDepartmentsFromExisting,
} from '../lib/departments.js';

function mapDepartmentRow(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description || '',
    is_active: row.is_active ?? 1,
  };
}

export function registerDepartmentRoutes(app) {
  app.get(
    '/api/departments',
    requirePermission('reports:read'),
    asyncHandler(async (req, res) => {
      await syncDepartmentsFromExisting();
      const scope = resolveDepartment(req, req.query.department);
      if (scope.locked && scope.department) {
        const row = await one(
          'SELECT * FROM departments WHERE name = ? AND is_active = 1',
          [scope.department]
        );
        return res.json(row ? [mapDepartmentRow(row)] : [{ id: 0, code: 'SCOPE', name: scope.department, description: '', is_active: 1 }]);
      }
      const rows = await all(
        'SELECT * FROM departments WHERE is_active = 1 ORDER BY name',
        []
      );
      res.json(rows.map(mapDepartmentRow));
    })
  );

  app.post(
    '/api/departments',
    requirePermission('staff:write'),
    asyncHandler(async (req, res) => {
      const code = normalizeDepartmentCode(req.body?.code);
      const name = normalizeDepartmentName(req.body?.name);
      const description = String(req.body?.description || '').trim().slice(0, 500);

      if (!code || code.length < 2) {
        return res.status(400).json({ error: 'Department ID must be at least 2 characters (letters/numbers)' });
      }
      if (!/^[A-Z0-9][A-Z0-9_-]*$/.test(code)) {
        return res.status(400).json({ error: 'Department ID may use letters, numbers, hyphen, underscore only' });
      }
      if (!name || name.length < 2) {
        return res.status(400).json({ error: 'Department name is required' });
      }

      const codeTaken = await one('SELECT id FROM departments WHERE code = ?', [code]);
      if (codeTaken) return res.status(409).json({ error: `Department ID "${code}" is already in use` });

      const nameTaken = await one('SELECT id FROM departments WHERE lower(name) = lower(?)', [name]);
      if (nameTaken) return res.status(409).json({ error: `Department "${name}" already exists` });

      const r = await run('INSERT INTO departments (code, name, description) VALUES (?, ?, ?)', [
        code,
        name,
        description,
      ]);
      const row = await one('SELECT * FROM departments WHERE id = ?', [r.lastInsertRowid]);
      res.status(201).json(mapDepartmentRow(row));
    })
  );
}
