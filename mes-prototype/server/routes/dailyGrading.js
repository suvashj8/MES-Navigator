import { one, all, run } from '../db.js';
import { asyncHandler } from '../asyncHandler.js';
import { requirePermission } from '../middleware.js';
import { resolveDepartment } from '../scope.js';
import { calculateGrade, findStandard } from '../grading.js';
import { writeDailyAudit } from '../lib/dailyGradingAudit.js';
import { getProductMasterByCode } from '../lib/productMasterHelpers.js';

export function registerDailyGradingRoutes(app) {
app.get('/api/daily-grading', requirePermission('reports:read'), asyncHandler(async (req, res) => {
  const { date, staff_id } = req.query;
  const { department } = resolveDepartment(req, req.query.department);
  let sql = `
    SELECT dg.*, s.name as staff_name, s.reg_no, s.department,
           gs.prod_name, gs.cost_center_name
    FROM daily_grading dg
    JOIN staff s ON s.id = dg.staff_id
    LEFT JOIN grading_standards gs ON gs.prod_code = dg.prod_code AND gs.cost_center_code = dg.cost_center_code
    WHERE dg.deleted_at IS NULL
  `;
  const params = [];
  if (date) { sql += ' AND dg.entry_date = ?'; params.push(date); }
  if (staff_id) { sql += ' AND dg.staff_id = ?'; params.push(staff_id); }
  if (department) { sql += ' AND s.department = ?'; params.push(department); }
  sql += ' ORDER BY dg.entry_date DESC, s.reg_no';
  res.json(await all(sql, [...params]));
}));

app.post('/api/daily-grading', requirePermission('daily-grading:write'), asyncHandler(async (req, res) => {
  const { entry_date, staff_id, prod_code, cost_center_code, quantity, remarks } = req.body;
  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty < 0) {
    return res.status(400).json({ error: 'quantity cannot be negative' });
  }
  if (!(await getProductMasterByCode(prod_code))) {
    return res.status(400).json({
      error: 'Product must exist in Product Master before production entry.',
    });
  }
  const staffRow = await one('SELECT department FROM staff WHERE id = ?', [staff_id]);
  if (!staffRow) return res.status(400).json({ error: 'Invalid staff' });
  if (req.user.role === 'supervisor' && req.user.department && staffRow.department !== req.user.department) {
    return res.status(403).json({ error: 'Cannot record grading for staff outside your department' });
  }
  const std = await findStandard(prod_code, cost_center_code, entry_date);
  if (!std) return res.status(400).json({ error: 'No grading standard for product/cost center' });

  const calc = calculateGrade(qty, std);
  const entered_by = req.user.username;
  const existing = await one(
    'SELECT id FROM daily_grading WHERE entry_date=? AND staff_id=? AND prod_code=? AND cost_center_code=?'
  , [entry_date, staff_id, prod_code, cost_center_code]);

  if (existing) {
    const before = await one('SELECT * FROM daily_grading WHERE id = ?', [existing.id]);
    await run(`
      UPDATE daily_grading SET quantity=?, per_day_qty=?, working_min=?, c_time_min=?,
        p_hour=?, w_hour=?, w_min=?, grade=?, remarks=?,
        updated_by=?, updated_at=datetime('now'),
        deleted_at=NULL
      WHERE id=?
    `, [quantity, calc.per_day_qty, calc.working_min, calc.c_time_min,
      calc.p_hour, calc.w_hour, calc.w_min, calc.grade, remarks || null, entered_by, existing.id]);
    const after = await one('SELECT * FROM daily_grading WHERE id = ?', [existing.id]);
    await writeDailyAudit({ entry_id: existing.id, action: 'update', actor: req.user.username, oldRow: before, newRow: after });
    return res.json(after);
  }

  const r = await run(`
    INSERT INTO daily_grading (
      entry_date, staff_id, prod_code, cost_center_code, quantity,
      per_day_qty, working_min, c_time_min, p_hour, w_hour, w_min, grade, remarks, entered_by
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `, [entry_date, staff_id, prod_code, cost_center_code, quantity,
    calc.per_day_qty, calc.working_min, calc.c_time_min,
    calc.p_hour, calc.w_hour, calc.w_min, calc.grade, remarks || null, entered_by]);
  const created = await one('SELECT * FROM daily_grading WHERE id = ?', [r.lastInsertRowid]);
  await writeDailyAudit({ entry_id: created.id, action: 'create', actor: req.user.username, oldRow: null, newRow: created });
  res.status(201).json(created);
}));

app.get('/api/daily-grading/deleted', requirePermission('daily-grading:delete'), asyncHandler(async (req, res) => {
  const offset = Math.max(0, Number(req.query.offset || 0) || 0);
  const limit = Math.min(200, Math.max(1, Number(req.query.limit || 50) || 50));
  const { department } = resolveDepartment(req, req.query.department);
  const staff_q = String(req.query.q || '').trim();

  let baseWhere = `WHERE dg.deleted_at IS NOT NULL`;
  const params = [];
  if (department) {
    baseWhere += ' AND s.department = ?';
    params.push(department);
  }
  if (staff_q) {
    baseWhere += ' AND (s.name LIKE ? OR CAST(s.reg_no AS TEXT) LIKE ?)';
    params.push(`%${staff_q}%`, `%${staff_q}%`);
  }

  const total =
    (await one(
      `
    SELECT COUNT(*) as c
    FROM daily_grading dg
    JOIN staff s ON s.id = dg.staff_id
    ${baseWhere}
  `,
      [...params]
    ))?.c ?? 0;

  const rows = await all(`
    SELECT dg.*, s.name as staff_name, s.reg_no, s.department,
           gs.prod_name, gs.cost_center_name
    FROM daily_grading dg
    JOIN staff s ON s.id = dg.staff_id
    LEFT JOIN grading_standards gs ON gs.prod_code = dg.prod_code AND gs.cost_center_code = dg.cost_center_code
    ${baseWhere}
    ORDER BY dg.deleted_at DESC, dg.id DESC
    LIMIT ? OFFSET ?
  `, [...params, limit, offset]);

  res.json({ rows, total, offset, limit, scope: resolveDepartment(req, req.query.department) });
}));

app.get('/api/daily-grading/:id/audit', requirePermission('daily-grading:delete'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const rows = await all(
    `SELECT id, entry_id, action, actor, at, old_values, new_values
     FROM daily_grading_audit
     WHERE entry_id = ?
     ORDER BY at DESC, id DESC
     LIMIT 200`
  , [id]);
  res.json({ rows });
}));

app.delete('/api/daily-grading/:id', requirePermission('daily-grading:delete'), asyncHandler(async (req, res) => {
  const before = await one('SELECT * FROM daily_grading WHERE id = ?', [req.params.id]);
  await run(`UPDATE daily_grading SET deleted_at=datetime('now'), deleted_by=? WHERE id = ?`, [req.user.username,
    req.params.id]);
  const after = await one('SELECT * FROM daily_grading WHERE id = ?', [req.params.id]);
  if (before && after) await writeDailyAudit({ entry_id: after.id, action: 'delete', actor: req.user.username, oldRow: before, newRow: after });
  res.json({ ok: true });
}));

app.post('/api/daily-grading/:id/restore', requirePermission('daily-grading:delete'), asyncHandler(async (req, res) => {
  const before = await one('SELECT * FROM daily_grading WHERE id = ?', [req.params.id]);
  if (!before) return res.status(404).json({ error: 'Not found' });
  await run('UPDATE daily_grading SET deleted_at=NULL, deleted_by=NULL WHERE id = ?', [req.params.id]);
  const after = await one('SELECT * FROM daily_grading WHERE id = ?', [req.params.id]);
  if (after) await writeDailyAudit({ entry_id: after.id, action: 'restore', actor: req.user.username, oldRow: before, newRow: after });
  res.json({ ok: true });
}));

app.delete('/api/daily-grading/:id/hard', requirePermission('users:manage'), asyncHandler(async (req, res) => {
  const before = await one('SELECT * FROM daily_grading WHERE id = ?', [req.params.id]);
  if (before) await writeDailyAudit({ entry_id: Number(req.params.id), action: 'hard_delete', actor: req.user.username, oldRow: before, newRow: null });
  await run('DELETE FROM daily_grading WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
}));

app.get('/api/daily-grading/export', requirePermission('reports:read'), asyncHandler(async (req, res) => {
  const { date } = req.query;
  const { department } = resolveDepartment(req, req.query.department);
  if (!date) return res.status(400).json({ error: 'date required' });
  let sql = `
    SELECT dg.entry_date, s.reg_no, s.name as staff_name, s.department,
           dg.prod_code, gs.prod_name, dg.cost_center_code, gs.cost_center_name,
           dg.quantity, dg.w_min, dg.grade, dg.remarks,
           dg.entered_by, dg.created_at,
           dg.updated_by, dg.updated_at
    FROM daily_grading dg
    JOIN staff s ON s.id = dg.staff_id
    LEFT JOIN grading_standards gs ON gs.prod_code = dg.prod_code AND gs.cost_center_code = dg.cost_center_code
    WHERE dg.deleted_at IS NULL AND dg.entry_date = ?
  `;
  const params = [date];
  if (department) { sql += ' AND s.department = ?'; params.push(department); }
  sql += ' ORDER BY s.reg_no';
  const rows = await all(sql, [...params]);
  const header = [
    'Date',
    'Reg No',
    'Staff',
    'Department',
    'Product',
    'Product Name',
    'Cost Center',
    'Cost Center Name',
    'Qty',
    'W Min',
    'Grade',
    'Remarks',
    'Entered By',
    'Entry Time',
    'Updated By',
    'Updated Time',
  ];
  const csv = [header, ...rows.map((r) => [
    r.entry_date, r.reg_no, r.staff_name, r.department, r.prod_code, r.prod_name || '',
    r.cost_center_code, r.cost_center_name || '', r.quantity, r.w_min, r.grade, r.remarks || '', r.entered_by || '', r.created_at || '',
    r.updated_by || '', r.updated_at || '',
  ])].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="daily-grading-${date}.csv"`);
  res.send(csv);
}));
}
