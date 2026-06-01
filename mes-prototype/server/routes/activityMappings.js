import { all, run } from '../db.js';
import { asyncHandler } from '../asyncHandler.js';
import { requirePermission } from '../middleware.js';

export function registerActivityMappingRoutes(app) {
app.post('/api/cost-centers', requirePermission('activity-mapping:write'), asyncHandler(async (req, res) => {
  const { code, name } = req.body;
  await run('INSERT OR REPLACE INTO cost_centers (code, name) VALUES (?, ?)', [code, name]);
  res.json({ code, name });
}));

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
