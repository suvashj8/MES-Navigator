import { one, all, run } from '../db.js';
import { asyncHandler } from '../asyncHandler.js';
import { requirePermission } from '../middleware.js';
import { resolveDepartment } from '../scope.js';

export function registerMissingStandardsRoutes(app) {
app.post('/api/missing-standards', requirePermission('daily-grading:write'), asyncHandler(async (req, res) => {
  const {
    entry_date,
    department,
    staff_id,
    staff_name,
    activity_id,
    activity_name,
    cost_center_code,
    cost_center_name,
    prod_code,
    prod_name,
  } = req.body || {};

  if (!entry_date || !prod_code) return res.status(400).json({ error: 'entry_date and prod_code required' });

  await run(`
    INSERT INTO missing_standards (
      entry_date, department, staff_id, staff_name, activity_id, activity_name,
      cost_center_code, cost_center_name, prod_code, prod_name, reported_by
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `, [entry_date,
    department || null,
    staff_id || null,
    staff_name || null,
    activity_id || null,
    activity_name || null,
    cost_center_code || null,
    cost_center_name || null,
    prod_code || null,
    prod_name || null,
    req.user.username]);

  res.json({ ok: true });
}));

app.get('/api/missing-standards', requirePermission('standards:read'), asyncHandler(async (req, res) => {
  const { date } = req.query;
  const today = date || new Date().toISOString().slice(0, 10);
  const scope = resolveDepartment(req, req.query.department);
  const params = [today];
  let where = 'ms.entry_date = ?';
  if (scope.locked && scope.department) {
    where += ' AND ms.department = ?';
    params.push(scope.department);
  }

  const rows = await all(`
    SELECT
      ms.prod_code,
      COALESCE(ms.prod_name, '') as prod_name,
      COALESCE(ms.activity_name, '') as activity_name,
      COALESCE(ms.cost_center_code, '') as cost_center_code,
      COALESCE(ms.cost_center_name, '') as cost_center_name,
      COALESCE(ms.department, '') as department,
      COUNT(*) as hits,
      MAX(ms.created_at) as last_seen
    FROM missing_standards ms
    WHERE ${where}
    GROUP BY ms.prod_code, ms.activity_name, ms.cost_center_code, ms.department
    ORDER BY last_seen DESC
  `, [...params]);

  res.json({ date: today, scope, rows });
}));
}
