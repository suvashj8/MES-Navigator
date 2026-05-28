import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import { db, initSchema } from './db.js';
import { calculateGrade, findStandard } from './grading.js';
import { login, seedDefaultUsers } from './auth.js';
import { requireAuth, requirePermission } from './middleware.js';
import { getScorecards, getPeriodRange, getWorkerDetail, getDashboardTrend } from './reports.js';
import { resolveDepartment } from './scope.js';
import { adToBs, bsToAd, todayPair } from './nepaliDate.js';
import { streamScorecardsPdf, streamWorkerPdf } from './pdf.js';

initSchema();
seedDefaultUsers();

const app = express();
app.use(cors());
// Staff photos are stored as small data URLs in JSON payloads (prototype-friendly).
app.use(express.json({ limit: '2mb' }));

function pickAuditValues(row) {
  if (!row) return null;
  const out = {
    id: row.id,
    entry_date: row.entry_date,
    staff_id: row.staff_id,
    prod_code: row.prod_code,
    cost_center_code: row.cost_center_code,
    quantity: row.quantity,
    grade: row.grade,
    remarks: row.remarks,
    entered_by: row.entered_by,
    created_at: row.created_at,
    updated_by: row.updated_by,
    updated_at: row.updated_at,
    deleted_by: row.deleted_by,
    deleted_at: row.deleted_at,
  };
  return out;
}

function writeDailyAudit({ entry_id, action, actor, oldRow, newRow }) {
  db.prepare(
    `INSERT INTO daily_grading_audit (entry_id, action, actor, old_values, new_values)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    entry_id,
    action,
    actor || null,
    oldRow ? JSON.stringify(pickAuditValues(oldRow)) : null,
    newRow ? JSON.stringify(pickAuditValues(newRow)) : null
  );
}

// --- Public auth ---
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const result = login(username, password);
  if (!result) return res.status(401).json({ error: 'Invalid username or password' });
  res.json(result);
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.patch('/api/auth/profile', requireAuth, (req, res) => {
  const { password, display_name } = req.body;
  if (display_name) {
    db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(display_name, req.user.id);
  }
  if (password) {
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(password, 10), req.user.id);
  }
  const user = db.prepare('SELECT id, username, role, display_name FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: { id: user.id, username: user.username, role: user.role, display_name: user.display_name } });
});

// Apply auth to all routes below
app.use('/api', requireAuth);

app.get('/api/auth/scope', (req, res) => {
  const scope = resolveDepartment(req, req.query.department);
  res.json(scope);
});

app.get('/api/nepali-date', (req, res) => {
  const { ad, bs } = req.query;
  if (ad) return res.json(adToBs(ad));
  if (bs) return res.json(bsToAd(bs));
  res.json(todayPair());
});

// --- Staff ---
app.get('/api/staff', requirePermission('reports:read'), (req, res) => {
  const { q } = req.query;
  const { department } = resolveDepartment(req, req.query.department);
  let sql = 'SELECT * FROM staff WHERE is_active = 1';
  const params = [];
  if (department) { sql += ' AND department = ?'; params.push(department); }
  if (q) { sql += ' AND (name LIKE ? OR CAST(reg_no AS TEXT) LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
  sql += ' ORDER BY reg_no';
  res.json(db.prepare(sql).all(...params));
});

app.post('/api/staff', requirePermission('staff:write'), (req, res) => {
  const { reg_no, name, department, photo_data } = req.body;
  const r = db.prepare('INSERT INTO staff (reg_no, name, department, photo_data) VALUES (?, ?, ?, ?)').run(
    reg_no,
    name,
    department,
    photo_data || null,
  );
  res.json(db.prepare('SELECT * FROM staff WHERE id = ?').get(r.lastInsertRowid));
});

// --- Activities ---
app.get('/api/activities', requirePermission('reports:read'), (_, res) => {
  res.json(db.prepare('SELECT * FROM activities ORDER BY code').all());
});

// --- Articles ---
app.get('/api/articles', requirePermission('reports:read'), (req, res) => {
  const { q } = req.query;
  if (q) {
    return res.json(
      db.prepare('SELECT * FROM articles WHERE display LIKE ? OR code LIKE ? LIMIT 50').all(`%${q}%`, `%${q}%`)
    );
  }
  res.json(db.prepare('SELECT * FROM articles ORDER BY code LIMIT 200').all());
});

// --- Cost centers ---
app.get('/api/cost-centers', requirePermission('reports:read'), (req, res) => {
  const { activity_id } = req.query;
  if (activity_id) {
    return res.json(
      db.prepare(`
        SELECT c.code, c.name FROM activity_cost_center_maps m
        JOIN cost_centers c ON c.code = m.cost_center_code
        WHERE m.activity_id = ?
        ORDER BY c.name
      `).all(activity_id)
    );
  }
  res.json(db.prepare('SELECT code, name FROM cost_centers ORDER BY name').all());
});

// --- Products with grading standards (for daily entry picker) ---
app.get('/api/grading-standards/products', requirePermission('standards:read'), (req, res) => {
  const { q, cost_center_code } = req.query;
  let sql = `
    SELECT DISTINCT prod_code, prod_name FROM grading_standards WHERE 1=1
  `;
  const params = [];
  if (cost_center_code) { sql += ' AND cost_center_code = ?'; params.push(cost_center_code); }
  if (q) { sql += ' AND (prod_code LIKE ? OR prod_name LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
  sql += ' ORDER BY prod_code LIMIT 50';
  res.json(db.prepare(sql).all(...params));
});

app.post('/api/cost-centers', requirePermission('activity-mapping:write'), (req, res) => {
  const { code, name } = req.body;
  db.prepare('INSERT OR REPLACE INTO cost_centers (code, name) VALUES (?, ?)').run(code, name);
  res.json({ code, name });
});

// --- Activity ↔ Cost Center mapping ---
app.get('/api/activity-mappings', requirePermission('reports:read'), (_, res) => {
  res.json(
    db.prepare(`
      SELECT m.id, m.activity_id, a.code as activity_code, a.name as activity_name,
             m.cost_center_code, c.name as cost_center_name
      FROM activity_cost_center_maps m
      JOIN activities a ON a.id = m.activity_id
      JOIN cost_centers c ON c.code = m.cost_center_code
      ORDER BY a.code, c.name
    `).all()
  );
});

app.get('/api/activity-mappings/by-activity/:activityId', requirePermission('reports:read'), (req, res) => {
  res.json(
    db.prepare(`
      SELECT m.*, c.name as cost_center_name
      FROM activity_cost_center_maps m
      JOIN cost_centers c ON c.code = m.cost_center_code
      WHERE m.activity_id = ?
    `).all(req.params.activityId)
  );
});

app.post('/api/activity-mappings', requirePermission('activity-mapping:write'), (req, res) => {
  const { activity_id, cost_center_code } = req.body;
  try {
    const r = db.prepare(
      'INSERT INTO activity_cost_center_maps (activity_id, cost_center_code) VALUES (?, ?)'
    ).run(activity_id, cost_center_code);
    res.status(201).json({ id: r.lastInsertRowid, activity_id, cost_center_code });
  } catch (e) {
    res.status(400).json({ error: e.message.includes('UNIQUE') ? 'Mapping already exists' : e.message });
  }
});

app.delete('/api/activity-mappings/:id', requirePermission('activity-mapping:write'), (req, res) => {
  db.prepare('DELETE FROM activity_cost_center_maps WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// --- Grading standards CRUD ---
app.get('/api/grading-standards', requirePermission('standards:read'), (req, res) => {
  const { prod_code, cost_center_code, q } = req.query;
  let sql = 'SELECT * FROM grading_standards WHERE 1=1';
  const params = [];
  if (prod_code) { sql += ' AND prod_code = ?'; params.push(prod_code); }
  if (cost_center_code) { sql += ' AND cost_center_code = ?'; params.push(cost_center_code); }
  if (q) {
    sql += ' AND (prod_code LIKE ? OR prod_name LIKE ? OR cost_center_name LIKE ?)';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  sql += ' ORDER BY prod_code, cost_center_code';
  res.json(db.prepare(sql).all(...params));
});

app.get('/api/grading-standards/lookup', requirePermission('standards:read'), (req, res) => {
  const { prod_code, cost_center_code, entry_date } = req.query;
  const std = findStandard(db, prod_code, cost_center_code, entry_date);
  if (!std) return res.status(404).json({ error: 'No grading standard found' });
  res.json(std);
});

app.get('/api/grading-standards/:id', requirePermission('standards:read'), (req, res) => {
  const row = db.prepare('SELECT * FROM grading_standards WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

app.post('/api/grading-standards', requirePermission('standards:write'), (req, res) => {
  const b = req.body;
  db.prepare(
    'INSERT OR IGNORE INTO cost_centers (code, name) VALUES (?, ?)'
  ).run(b.cost_center_code, b.cost_center_name);
  try {
    const r = db.prepare(`
      INSERT INTO grading_standards (
        prod_code, prod_name, cost_center_code, cost_center_name,
        standard_min, std_qty, c_value, b_value, a_value, aplus_value,
        effective_date, created_by, updated_by
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      b.prod_code, b.prod_name, b.cost_center_code, b.cost_center_name,
      b.standard_min ?? 420, b.std_qty, b.c_value, b.b_value, b.a_value, b.aplus_value,
      b.effective_date || null, req.user.username, req.user.username
    );
    res.status(201).json(db.prepare('SELECT * FROM grading_standards WHERE id = ?').get(r.lastInsertRowid));
  } catch (e) {
    res.status(400).json({ error: 'Duplicate standard for product/cost center/date' });
  }
});

app.put('/api/grading-standards/:id', requirePermission('standards:write'), (req, res) => {
  const b = req.body;
  const existing = db.prepare('SELECT id FROM grading_standards WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  db.prepare(
    'INSERT OR IGNORE INTO cost_centers (code, name) VALUES (?, ?)'
  ).run(b.cost_center_code, b.cost_center_name);
  db.prepare(`
    UPDATE grading_standards SET
      prod_code=?, prod_name=?, cost_center_code=?, cost_center_name=?,
      standard_min=?, std_qty=?, c_value=?, b_value=?, a_value=?, aplus_value=?,
      effective_date=?, updated_by=?
    WHERE id=?
  `).run(
    b.prod_code, b.prod_name, b.cost_center_code, b.cost_center_name,
    b.standard_min ?? 420, b.std_qty, b.c_value, b.b_value, b.a_value, b.aplus_value,
    b.effective_date || null, req.user.username, req.params.id
  );
  res.json(db.prepare('SELECT * FROM grading_standards WHERE id = ?').get(req.params.id));
});

app.delete('/api/grading-standards/:id', requirePermission('standards:write'), (req, res) => {
  db.prepare('DELETE FROM grading_standards WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.post('/api/grade/preview', requirePermission('daily-grading:write'), (req, res) => {
  const { prod_code, cost_center_code, quantity, entry_date } = req.body;
  const std = findStandard(db, prod_code, cost_center_code, entry_date);
  if (!std) return res.status(404).json({ error: 'Standard not found' });
  res.json({ standard: std, ...calculateGrade(Number(quantity), std) });
});

// --- Daily grading ---
app.get('/api/daily-grading', requirePermission('reports:read'), (req, res) => {
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
  res.json(db.prepare(sql).all(...params));
});

app.post('/api/daily-grading', requirePermission('daily-grading:write'), (req, res) => {
  const { entry_date, staff_id, prod_code, cost_center_code, quantity, remarks } = req.body;
  const staffRow = db.prepare('SELECT department FROM staff WHERE id = ?').get(staff_id);
  if (!staffRow) return res.status(400).json({ error: 'Invalid staff' });
  if (req.user.role === 'supervisor' && req.user.department && staffRow.department !== req.user.department) {
    return res.status(403).json({ error: 'Cannot record grading for staff outside your department' });
  }
  const std = findStandard(db, prod_code, cost_center_code, entry_date);
  if (!std) return res.status(400).json({ error: 'No grading standard for product/cost center' });

  const calc = calculateGrade(Number(quantity), std);
  const entered_by = req.user.username;
  const existing = db.prepare(
    'SELECT id FROM daily_grading WHERE entry_date=? AND staff_id=? AND prod_code=? AND cost_center_code=?'
  ).get(entry_date, staff_id, prod_code, cost_center_code);

  if (existing) {
    const before = db.prepare('SELECT * FROM daily_grading WHERE id = ?').get(existing.id);
    db.prepare(`
      UPDATE daily_grading SET quantity=?, per_day_qty=?, working_min=?, c_time_min=?,
        p_hour=?, w_hour=?, w_min=?, grade=?, remarks=?,
        updated_by=?, updated_at=datetime('now'),
        deleted_at=NULL
      WHERE id=?
    `).run(
      quantity, calc.per_day_qty, calc.working_min, calc.c_time_min,
      calc.p_hour, calc.w_hour, calc.w_min, calc.grade, remarks || null, entered_by, existing.id
    );
    const after = db.prepare('SELECT * FROM daily_grading WHERE id = ?').get(existing.id);
    writeDailyAudit({ entry_id: existing.id, action: 'update', actor: req.user.username, oldRow: before, newRow: after });
    return res.json(after);
  }

  const r = db.prepare(`
    INSERT INTO daily_grading (
      entry_date, staff_id, prod_code, cost_center_code, quantity,
      per_day_qty, working_min, c_time_min, p_hour, w_hour, w_min, grade, remarks, entered_by
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    entry_date, staff_id, prod_code, cost_center_code, quantity,
    calc.per_day_qty, calc.working_min, calc.c_time_min,
    calc.p_hour, calc.w_hour, calc.w_min, calc.grade, remarks || null, entered_by
  );
  const created = db.prepare('SELECT * FROM daily_grading WHERE id = ?').get(r.lastInsertRowid);
  writeDailyAudit({ entry_id: created.id, action: 'create', actor: req.user.username, oldRow: null, newRow: created });
  res.status(201).json(created);
});

app.get('/api/daily-grading/deleted', requirePermission('daily-grading:delete'), (req, res) => {
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

  const total = db.prepare(`
    SELECT COUNT(*) as c
    FROM daily_grading dg
    JOIN staff s ON s.id = dg.staff_id
    ${baseWhere}
  `).get(...params).c;

  const rows = db.prepare(`
    SELECT dg.*, s.name as staff_name, s.reg_no, s.department,
           gs.prod_name, gs.cost_center_name
    FROM daily_grading dg
    JOIN staff s ON s.id = dg.staff_id
    LEFT JOIN grading_standards gs ON gs.prod_code = dg.prod_code AND gs.cost_center_code = dg.cost_center_code
    ${baseWhere}
    ORDER BY dg.deleted_at DESC, dg.id DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  res.json({ rows, total, offset, limit, scope: resolveDepartment(req, req.query.department) });
});

app.get('/api/daily-grading/:id/audit', requirePermission('daily-grading:delete'), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const rows = db.prepare(
    `SELECT id, entry_id, action, actor, at, old_values, new_values
     FROM daily_grading_audit
     WHERE entry_id = ?
     ORDER BY at DESC, id DESC
     LIMIT 200`
  ).all(id);
  res.json({ rows });
});

app.delete('/api/daily-grading/:id', requirePermission('daily-grading:delete'), (req, res) => {
  const before = db.prepare('SELECT * FROM daily_grading WHERE id = ?').get(req.params.id);
  db.prepare(`UPDATE daily_grading SET deleted_at=datetime('now'), deleted_by=? WHERE id = ?`).run(
    req.user.username,
    req.params.id
  );
  const after = db.prepare('SELECT * FROM daily_grading WHERE id = ?').get(req.params.id);
  if (before && after) writeDailyAudit({ entry_id: after.id, action: 'delete', actor: req.user.username, oldRow: before, newRow: after });
  res.json({ ok: true });
});

app.post('/api/daily-grading/:id/restore', requirePermission('daily-grading:delete'), (req, res) => {
  const before = db.prepare('SELECT * FROM daily_grading WHERE id = ?').get(req.params.id);
  if (!before) return res.status(404).json({ error: 'Not found' });
  db.prepare('UPDATE daily_grading SET deleted_at=NULL, deleted_by=NULL WHERE id = ?').run(req.params.id);
  const after = db.prepare('SELECT * FROM daily_grading WHERE id = ?').get(req.params.id);
  if (after) writeDailyAudit({ entry_id: after.id, action: 'restore', actor: req.user.username, oldRow: before, newRow: after });
  res.json({ ok: true });
});

app.delete('/api/daily-grading/:id/hard', requirePermission('users:manage'), (req, res) => {
  const before = db.prepare('SELECT * FROM daily_grading WHERE id = ?').get(req.params.id);
  if (before) writeDailyAudit({ entry_id: Number(req.params.id), action: 'hard_delete', actor: req.user.username, oldRow: before, newRow: null });
  db.prepare('DELETE FROM daily_grading WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/daily-grading/export', requirePermission('reports:read'), (req, res) => {
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
  const rows = db.prepare(sql).all(...params);
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
});

// --- Reports / Scorecards ---
app.get('/api/reports/scorecards', requirePermission('reports:read'), (req, res) => {
  const { period = 'weekly', anchor, from, to, staff_id } = req.query;
  const { department } = resolveDepartment(req, req.query.department);
  let range;
  if (from && to) {
    range = { from, to, label: `${from} to ${to}` };
  } else {
    range = getPeriodRange(period, anchor);
  }
  const cards = getScorecards(db, {
    from: range.from,
    to: range.to,
    department: department || undefined,
    staff_id: staff_id ? Number(staff_id) : undefined,
  });
  res.json({ period, ...range, scorecards: cards, scope: resolveDepartment(req, req.query.department) });
});

app.get('/api/reports/worker/:staffId', requirePermission('reports:read'), (req, res) => {
  const { from, to, period = 'weekly', anchor } = req.query;
  let range;
  if (from && to) range = { from, to };
  else range = getPeriodRange(period, anchor);
  const detail = getWorkerDetail(db, Number(req.params.staffId), range);
  if (!detail) return res.status(404).json({ error: 'Worker not found' });
  res.json(detail);
});

// --- Dashboard ---
app.get('/api/dashboard', requirePermission('reports:read'), (req, res) => {
  const { date, not_graded_offset, not_graded_limit } = req.query;
  const today = date || new Date().toISOString().slice(0, 10);
  const { department } = resolveDepartment(req, req.query.department);
  const gradeDist = db.prepare(
    'SELECT grade, COUNT(*) as count FROM daily_grading WHERE deleted_at IS NULL AND entry_date = ? GROUP BY grade'
  ).all(today);
  const deptSummary = db.prepare(`
    SELECT s.department, dg.grade, COUNT(*) as count
    FROM daily_grading dg JOIN staff s ON s.id = dg.staff_id
    WHERE dg.deleted_at IS NULL AND dg.entry_date = ? GROUP BY s.department, dg.grade
  `).all(today);
  const weekSummary = getScorecards(db, getPeriodRange('weekly', today));

  const allStaff = db.prepare(
    `SELECT id, reg_no, name, department FROM staff WHERE is_active=1${department ? ' AND department = ?' : ''} ORDER BY reg_no`
  ).all(...(department ? [department] : []));
  const gradedIds = new Set(
    db.prepare(
      `SELECT DISTINCT dg.staff_id as id
       FROM daily_grading dg
       JOIN staff s ON s.id = dg.staff_id
       WHERE dg.deleted_at IS NULL AND dg.entry_date = ?${department ? ' AND s.department = ?' : ''}`
    ).all(...(department ? [today, department] : [today])).map((r) => r.id)
  );
  const allNotGraded = allStaff.filter((s) => !gradedIds.has(s.id));
  const offset = Math.max(0, Number(not_graded_offset || 0) || 0);
  const limit = Math.min(50, Math.max(1, Number(not_graded_limit || 10) || 10));
  const workersNotGradedToday = allNotGraded.slice(offset, offset + limit);

  res.json({
    date: today,
    todayEntries: db.prepare('SELECT COUNT(*) as c FROM daily_grading WHERE deleted_at IS NULL AND entry_date = ?').get(today).c,
    staffCount: db.prepare('SELECT COUNT(*) as c FROM staff WHERE is_active=1').get().c,
    standardsCount: db.prepare('SELECT COUNT(*) as c FROM grading_standards').get().c,
    gradeDist,
    deptSummary,
    trend: getDashboardTrend(db, today, 7),
    weekWorkersGraded: weekSummary.length,
    weekEntries: weekSummary.reduce((s, c) => s + c.total_entries, 0),
    workersNotGradedToday,
    workersNotGradedTotal: allNotGraded.length,
    workersNotGradedOffset: offset,
    workersNotGradedLimit: limit,
  });
});

// --- Missing standards inbox ---
app.post('/api/missing-standards', requirePermission('daily-grading:write'), (req, res) => {
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

  db.prepare(`
    INSERT INTO missing_standards (
      entry_date, department, staff_id, staff_name, activity_id, activity_name,
      cost_center_code, cost_center_name, prod_code, prod_name, reported_by
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    entry_date,
    department || null,
    staff_id || null,
    staff_name || null,
    activity_id || null,
    activity_name || null,
    cost_center_code || null,
    cost_center_name || null,
    prod_code || null,
    prod_name || null,
    req.user.username
  );

  res.json({ ok: true });
});

app.get('/api/missing-standards', requirePermission('standards:read'), (req, res) => {
  const { date } = req.query;
  const today = date || new Date().toISOString().slice(0, 10);
  const scope = resolveDepartment(req, req.query.department);
  const params = [today];
  let where = 'ms.entry_date = ?';
  if (scope.locked && scope.department) {
    where += ' AND ms.department = ?';
    params.push(scope.department);
  }

  const rows = db.prepare(`
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
  `).all(...params);

  res.json({ date: today, scope, rows });
});

app.get('/api/departments', requirePermission('reports:read'), (req, res) => {
  const scope = resolveDepartment(req, req.query.department);
  if (scope.locked && scope.department) {
    return res.json([scope.department]);
  }
  res.json(db.prepare('SELECT DISTINCT department FROM staff ORDER BY department').all().map((r) => r.department));
});

// --- User management (admin) ---
app.get('/api/users', requirePermission('users:manage'), (_, res) => {
  res.json(
    db.prepare('SELECT id, username, role, display_name, department, is_active FROM users ORDER BY username').all()
  );
});

app.post('/api/users', requirePermission('users:manage'), (req, res) => {
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
    const r = db.prepare(
      'INSERT INTO users (username, password_hash, role, display_name, department) VALUES (?, ?, ?, ?, ?)'
    ).run(username, bcrypt.hashSync(password, 10), role, display_name, department || null);
    res.status(201).json(
      db.prepare('SELECT id, username, role, display_name, department, is_active FROM users WHERE id = ?').get(r.lastInsertRowid)
    );
  } catch (e) {
    res.status(400).json({ error: e.message.includes('UNIQUE') ? 'Username already exists' : e.message });
  }
});

app.patch('/api/users/:id', requirePermission('users:manage'), (req, res) => {
  const { role, display_name, is_active, password, department } = req.body;
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  if (Number(req.params.id) === req.user.id && is_active === 0) {
    return res.status(400).json({ error: 'Cannot deactivate your own account' });
  }
  if (password) {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(password, 10), req.params.id);
  }
  if (role != null) db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  if (display_name != null) db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(display_name, req.params.id);
  if (department !== undefined) db.prepare('UPDATE users SET department = ? WHERE id = ?').run(department || null, req.params.id);
  if (is_active != null) db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(is_active ? 1 : 0, req.params.id);
  res.json(
    db.prepare('SELECT id, username, role, display_name, department, is_active FROM users WHERE id = ?').get(req.params.id)
  );
});

// --- CSV export scorecards ---
app.get('/api/reports/scorecards/export', requirePermission('reports:read'), (req, res) => {
  const { period = 'weekly', anchor, from, to, staff_id } = req.query;
  const { department } = resolveDepartment(req, req.query.department);
  let range;
  if (from && to) range = { from, to, label: `${from} to ${to}` };
  else range = getPeriodRange(period, anchor);
  const cards = getScorecards(db, {
    from: range.from,
    to: range.to,
    department: department || undefined,
    staff_id: staff_id ? Number(staff_id) : undefined,
  });
  const header = ['Reg No', 'Staff Name', 'Department', 'Entries', 'Days Worked', 'Total Qty', 'Avg Score', 'Rating', 'Grade C', 'Grade B', 'Grade A', 'Grade AA'];
  const rows = cards.map((c) => [
    c.reg_no, c.staff_name, c.department, c.total_entries, c.days_worked, c.total_quantity,
    c.avg_score, c.rating,
    c.grade_distribution.find((g) => g.grade === 'C')?.count ?? 0,
    c.grade_distribution.find((g) => g.grade === 'B')?.count ?? 0,
    c.grade_distribution.find((g) => g.grade === 'A')?.count ?? 0,
    c.grade_distribution.find((g) => g.grade === 'AA')?.count ?? 0,
  ]);
  const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="scorecards-${range.from}-${range.to}.csv"`);
  res.send(csv);
});

// --- PDF export scorecards ---
app.get('/api/reports/scorecards/export.pdf', requirePermission('reports:read'), (req, res) => {
  const { period = 'weekly', anchor, from, to, staff_id } = req.query;
  const { department } = resolveDepartment(req, req.query.department);
  let range;
  if (from && to) range = { from, to, label: `${from} to ${to}` };
  else range = getPeriodRange(period, anchor);
  const cards = getScorecards(db, {
    from: range.from,
    to: range.to,
    department: department || undefined,
    staff_id: staff_id ? Number(staff_id) : undefined,
  });
  streamScorecardsPdf(res, { ...range, scorecards: cards });
});

app.get('/api/reports/worker/:staffId/export.pdf', requirePermission('reports:read'), (req, res) => {
  const { from, to, period = 'weekly', anchor } = req.query;
  let range;
  if (from && to) range = { from, to };
  else range = getPeriodRange(period, anchor);
  const detail = getWorkerDetail(db, Number(req.params.staffId), range);
  if (!detail) return res.status(404).json({ error: 'Worker not found' });
  if (req.user.role === 'supervisor' && req.user.department && detail.staff.department !== req.user.department) {
    return res.status(403).json({ error: 'Access denied for this department' });
  }
  streamWorkerPdf(res, detail);
});

const PORT = 3001;
app.listen(PORT, () => console.log(`MES API running on http://localhost:${PORT}`));
