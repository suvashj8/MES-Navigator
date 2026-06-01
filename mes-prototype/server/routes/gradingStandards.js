import { one, all, run } from '../db.js';
import { asyncHandler } from '../asyncHandler.js';
import { requirePermission } from '../middleware.js';
import { resolveDepartment } from '../scope.js';
import { calculateGrade, findStandard } from '../grading.js';
import { resolveGradingStandardProduct } from '../lib/gradingStandardResolve.js';
import {
  getGradingStandardsLinkSummary,
  linkGradingStandardsToProductMaster,
} from '../productMasterLink.js';

export function registerGradingStandardsRoutes(app) {
app.get('/api/grading-standards', requirePermission('standards:read'), asyncHandler(async (req, res) => {
  const { prod_code, cost_center_code, q } = req.query;
  let sql = `
    SELECT
      gs.*,
      pm.id AS product_master_id,
      pm.description AS master_description,
      pm.base_uom AS master_base_uom,
      pm.type AS master_type,
      pm.product_nature AS master_product_nature,
      pm.vat_category AS master_vat_category,
      CASE WHEN pm.id IS NOT NULL THEN 1 ELSE 0 END AS in_product_master
    FROM grading_standards gs
    LEFT JOIN product_master pm ON pm.code = gs.prod_code
    WHERE 1=1
  `;
  const params = [];
  if (prod_code) { sql += ' AND gs.prod_code = ?'; params.push(prod_code); }
  if (cost_center_code) { sql += ' AND gs.cost_center_code = ?'; params.push(cost_center_code); }
  if (q) {
    sql += ' AND (gs.prod_code LIKE ? OR gs.prod_name LIKE ? OR gs.cost_center_name LIKE ? OR pm.description LIKE ?)';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  sql += ' ORDER BY gs.prod_code, gs.cost_center_code';
  res.json(await all(sql, [...params]));
}));

app.get('/api/grading-standards/product-master-link', requirePermission('standards:read'), asyncHandler(async (_req, res) => {
  res.json(await getGradingStandardsLinkSummary());
}));

app.post('/api/grading-standards/product-master-link', requirePermission('standards:write'), asyncHandler(async (req, res) => {
  const createMissing = req.body?.create_missing !== false;
  try {
    const result = await linkGradingStandardsToProductMaster({
      createMissing,
      createdBy: req.user?.username || 'system',
    });
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message || 'Link failed' });
  }
}));

app.get('/api/grading-standards/lookup', requirePermission('standards:read'), asyncHandler(async (req, res) => {
  const { prod_code, cost_center_code, entry_date } = req.query;
  const std = await findStandard(prod_code, cost_center_code, entry_date);
  if (!std) return res.status(404).json({ error: 'No grading standard found' });
  res.json(std);
}));

app.get('/api/grading-standards/:id', requirePermission('standards:read'), asyncHandler(async (req, res) => {
  const row = await one('SELECT * FROM grading_standards WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
}));

app.post('/api/grading-standards', requirePermission('standards:write'), asyncHandler(async (req, res) => {
  let b;
  try {
    b = await resolveGradingStandardProduct(req.body);
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.message });
  }
  await run(
    'INSERT OR IGNORE INTO cost_centers (code, name) VALUES (?, ?)'
  , [b.cost_center_code, b.cost_center_name]);
  try {
    const r = await run(`
      INSERT INTO grading_standards (
        prod_code, prod_name, product_master_id, cost_center_code, cost_center_name,
        standard_min, std_qty, c_value, b_value, a_value, aplus_value,
        effective_date, created_by, updated_by
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, [b.prod_code, b.prod_name, b.product_master_id, b.cost_center_code, b.cost_center_name,
      b.standard_min ?? 420, b.std_qty, b.c_value, b.b_value, b.a_value, b.aplus_value,
      b.effective_date || null, req.user.username, req.user.username]);
    res.status(201).json(await one('SELECT * FROM grading_standards WHERE id = ?', [r.lastInsertRowid]));
  } catch (e) {
    res.status(400).json({ error: 'Duplicate standard for product/cost center/date' });
  }
}));

app.put('/api/grading-standards/:id', requirePermission('standards:write'), asyncHandler(async (req, res) => {
  let b;
  try {
    b = await resolveGradingStandardProduct(req.body);
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.message });
  }
  const existing = await one('SELECT id FROM grading_standards WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  await run(
    'INSERT OR IGNORE INTO cost_centers (code, name) VALUES (?, ?)'
  , [b.cost_center_code, b.cost_center_name]);
  await run(`
    UPDATE grading_standards SET
      prod_code=?, prod_name=?, product_master_id=?, cost_center_code=?, cost_center_name=?,
      standard_min=?, std_qty=?, c_value=?, b_value=?, a_value=?, aplus_value=?,
      effective_date=?, updated_by=?
    WHERE id=?
  `, [b.prod_code, b.prod_name, b.product_master_id, b.cost_center_code, b.cost_center_name,
    b.standard_min ?? 420, b.std_qty, b.c_value, b.b_value, b.a_value, b.aplus_value,
    b.effective_date || null, req.user.username, req.params.id]);
  res.json(await one('SELECT * FROM grading_standards WHERE id = ?', [req.params.id]));
}));

app.delete('/api/grading-standards/:id', requirePermission('standards:write'), asyncHandler(async (req, res) => {
  await run('DELETE FROM grading_standards WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
}));

app.post('/api/grade/preview', requirePermission('daily-grading:write'), asyncHandler(async (req, res) => {
  const { prod_code, cost_center_code, quantity, entry_date } = req.body;
  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty < 0) {
    return res.status(400).json({ error: 'quantity cannot be negative' });
  }
  const std = await findStandard(prod_code, cost_center_code, entry_date);
  if (!std) return res.status(404).json({ error: 'Standard not found' });
  res.json({ standard: std, ...calculateGrade(qty, std) });
}));
}
