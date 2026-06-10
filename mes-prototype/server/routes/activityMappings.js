import { all, one, run } from '../db.js';
import { asyncHandler } from '../asyncHandler.js';
import { requirePermission } from '../middleware.js';
import {
  normalizeJobCode,
  normalizeJobName,
  normalizeWorkstationCode,
  normalizeWorkstationName,
} from '../lib/jobTypes.js';

export function registerActivityMappingRoutes(app) {
  app.post(
    '/api/activities',
    requirePermission('activity-mapping:write'),
    asyncHandler(async (req, res) => {
      const code = normalizeJobCode(req.body?.code);
      const name = normalizeJobName(req.body?.name);
      const description = String(req.body?.description || '').trim().slice(0, 500);

      if (code == null) {
        return res.status(400).json({ error: 'Job ID must be a positive whole number' });
      }
      if (!name || name.length < 2) {
        return res.status(400).json({ error: 'Job name is required' });
      }

      const codeTaken = await one('SELECT id FROM activities WHERE code = ?', [code]);
      if (codeTaken) return res.status(409).json({ error: `Job ID ${code} is already in use` });

      const nameTaken = await one('SELECT id FROM activities WHERE lower(name) = lower(?)', [name]);
      if (nameTaken) return res.status(409).json({ error: `Job "${name}" already exists` });

      const r = await run('INSERT INTO activities (code, name, description) VALUES (?, ?, ?)', [
        code,
        name,
        description,
      ]);
      const row = await one(
        'SELECT id, code, name, COALESCE(description, \'\') AS description FROM activities WHERE id = ?',
        [r.lastInsertRowid]
      );
      res.status(201).json(row);
    })
  );

  app.post(
    '/api/cost-centers',
    requirePermission('activity-mapping:write'),
    asyncHandler(async (req, res) => {
      const code = normalizeWorkstationCode(req.body?.code);
      const name = normalizeWorkstationName(req.body?.name);
      const description = String(req.body?.description || '').trim().slice(0, 500);

      if (!code || code.length < 2) {
        return res.status(400).json({ error: 'Work station ID must be at least 2 characters' });
      }
      if (!/^[A-Z0-9][A-Z0-9_-]*$/.test(code)) {
        return res.status(400).json({
          error: 'Work station ID may use letters, numbers, hyphen, underscore only',
        });
      }
      if (!name || name.length < 2) {
        return res.status(400).json({ error: 'Work station name is required' });
      }

      const codeTaken = await one('SELECT code FROM cost_centers WHERE code = ?', [code]);
      if (codeTaken) return res.status(409).json({ error: `Work station ID "${code}" is already in use` });

      await run('INSERT INTO cost_centers (code, name, description) VALUES (?, ?, ?)', [
        code,
        name,
        description,
      ]);
      res.status(201).json({ code, name, description });
    })
  );

// Activity ↔ Cost Center mapping ---
app.get('/api/activity-mappings', requirePermission('reports:read'), asyncHandler(async (_, res) => {
  res.json(
    await all(`
      SELECT m.id, m.activity_id, a.code as activity_code, a.name as activity_name,
             m.cost_center_code, c.name as cost_center_name
      FROM activity_cost_center_maps m
      JOIN activities a ON a.id = m.activity_id
      JOIN cost_centers c ON c.code = m.cost_center_code
      ORDER BY a.code, c.name
    `, [])
  );
}));

app.get('/api/activity-mappings/by-activity/:activityId', requirePermission('reports:read'), asyncHandler(async (req, res) => {
  res.json(
    await all(`
      SELECT m.*, c.name as cost_center_name
      FROM activity_cost_center_maps m
      JOIN cost_centers c ON c.code = m.cost_center_code
      WHERE m.activity_id = ?
    `, [req.params.activityId])
  );
}));

app.post('/api/activity-mappings', requirePermission('activity-mapping:write'), asyncHandler(async (req, res) => {
  const { activity_id, cost_center_code } = req.body;
  try {
    const r = await run(
      'INSERT INTO activity_cost_center_maps (activity_id, cost_center_code) VALUES (?, ?)'
    , [activity_id, cost_center_code]);
    res.status(201).json({ id: r.lastInsertRowid, activity_id, cost_center_code });
  } catch (e) {
    res.status(400).json({ error: e.message.toLowerCase().includes('unique') ? 'Mapping already exists' : e.message });
  }
}));

app.delete('/api/activity-mappings/:id', requirePermission('activity-mapping:write'), asyncHandler(async (req, res) => {
  await run('DELETE FROM activity_cost_center_maps WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
}));
}
