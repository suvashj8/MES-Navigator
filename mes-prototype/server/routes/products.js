import { one, all, run, transaction } from '../db.js';
import { asyncHandler } from '../asyncHandler.js';
import { requirePermission } from '../middleware.js';
import { resolveDepartment } from '../scope.js';
import { assertNonNegative } from '../validateNumbers.js';
import { getProductMasterByCode } from '../lib/productMasterHelpers.js';

export function registerProductsRoutes(app) {
// --- Products for grading (from Product Master + optional grading rule filter) ---
app.get('/api/grading-standards/products', requirePermission('standards:read'), asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  const costCenter = String(req.query.cost_center_code || '').trim();
  const requireStandard = req.query.require_standard !== '0';

  let sql = `
    SELECT DISTINCT
      pm.code AS prod_code,
      pm.description AS prod_name,
      pm.base_uom,
      pm.type AS product_type,
      pm.product_nature
    FROM product_master pm
  `;
  const params = [];

  if (requireStandard) {
    sql += `
      INNER JOIN grading_standards gs ON gs.prod_code = pm.code
    `;
    if (costCenter) {
      sql += ' AND gs.cost_center_code = ?';
      params.push(costCenter);
    }
  }

  sql += ' WHERE 1=1';
  if (q) {
    sql += ' AND (pm.code LIKE ? OR pm.description LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }

  sql += ' ORDER BY pm.code LIMIT 50';
  res.json(await all(sql, [...params]));
}));

// Product master + BOM ---
app.post('/api/products/auto-sync', requirePermission('standards:write'), asyncHandler(async (req, res) => {
  // Auto-derive from articles + grading_standards without overwriting manual rows.
  const articles = await all('SELECT code, name FROM articles', []);
  const std = await all('SELECT DISTINCT prod_code as code, prod_name as name FROM grading_standards', []);
  const byCode = new Map();
  for (const a of articles) byCode.set(String(a.code), String(a.name));
  for (const s of std) {
    const code = String(s.code);
    if (!byCode.has(code) && s.name) byCode.set(code, String(s.name));
  }

  const upsertSql = `
    INSERT INTO products (code, name, source, created_at)
    VALUES (?, ?, 'auto', CURRENT_TIMESTAMP)
    ON CONFLICT(code) DO UPDATE SET
      name=excluded.name,
      updated_at=CURRENT_TIMESTAMP
    WHERE products.source='auto'
  `;
  let created = 0;
  let updated = 0;
  for (const [code, name] of byCode.entries()) {
    const existing = await one('SELECT code, source FROM products WHERE code = ?', [code]);
    const r = await run(upsertSql, [code, name || code]);
    if (!existing) created += 1;
    else if (existing.source === 'auto' && r.changes > 0) updated += 1;
  }
  res.json({ ok: true, created, updated, total: byCode.size });
}));

app.get('/api/products', requirePermission('reports:read'), asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  const department = String(req.query.department || '').trim();
  const family = String(req.query.family || '').trim();
  const group = String(req.query.group || '').trim();
  const offset = Math.max(0, Number(req.query.offset || 0) || 0);
  const limit = Math.min(200, Math.max(1, Number(req.query.limit || 50) || 50));

  let where = 'WHERE 1=1';
  const params = [];
  if (q) { where += ' AND (code LIKE ? OR name LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
  if (department) { where += ' AND ref_department = ?'; params.push(department); }
  if (family) { where += ' AND family = ?'; params.push(family); }
  if (group) { where += ' AND group_name = ?'; params.push(group); }

  const total = (await one(`SELECT COUNT(*) as c FROM products ${where}`, [...params]))?.c ?? 0;
  const rows = await all(`
    SELECT * FROM products
    ${where}
    ORDER BY code
    LIMIT ? OFFSET ?
  `, [...params, limit, offset]);
  res.json({ rows, total, offset, limit });
}));

app.get('/api/products/:code', requirePermission('reports:read'), asyncHandler(async (req, res) => {
  const code = String(req.params.code);
  const product = await one('SELECT * FROM products WHERE code = ?', [code]);
  if (!product) return res.status(404).json({ error: 'Not found' });
  const components = await all(
    'SELECT * FROM product_components WHERE product_code = ? ORDER BY sort_order, id'
  , [code]);
  res.json({ product, components });
}));

app.post('/api/products', requirePermission('standards:write'), asyncHandler(async (req, res) => {
  const b = req.body || {};
  const code = String(b.code || '').trim();
  const name = String(b.name || '').trim();
  if (!code) return res.status(400).json({ error: 'code required' });
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    await run(`
      INSERT INTO products (code, name, family, group_name, parent_item_no, uom, ref_department, source, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', datetime('now'), datetime('now'))
    `, [code,
      name,
      b.family ? String(b.family).trim() : null,
      b.group_name ? String(b.group_name).trim() : null,
      b.parent_item_no ? String(b.parent_item_no).trim() : null,
      b.uom ? String(b.uom).trim() : null,
      b.ref_department ? String(b.ref_department).trim() : null]);
  } catch (e) {
    return res.status(400).json({ error: e.message.toLowerCase().includes('unique') ? 'Product code already exists' : e.message });
  }
  const product = await one('SELECT * FROM products WHERE code = ?', [code]);
  res.status(201).json(product);
}));

app.put('/api/products/:code', requirePermission('standards:write'), asyncHandler(async (req, res) => {
  const code = String(req.params.code);
  const b = req.body || {};
  const existing = await one('SELECT * FROM products WHERE code = ?', [code]);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const name = b.name != null ? String(b.name).trim() : existing.name;
  if (!name) return res.status(400).json({ error: 'name required' });

  await run(`
    UPDATE products SET
      name=?,
      family=?,
      group_name=?,
      parent_item_no=?,
      uom=?,
      ref_department=?,
      source='manual',
      updated_at=datetime('now')
    WHERE code=?
  `, [name,
    b.family != null ? String(b.family).trim() || null : existing.family,
    b.group_name != null ? String(b.group_name).trim() || null : existing.group_name,
    b.parent_item_no != null ? String(b.parent_item_no).trim() || null : existing.parent_item_no,
    b.uom != null ? String(b.uom).trim() || null : existing.uom,
    b.ref_department != null ? String(b.ref_department).trim() || null : existing.ref_department,
    code]);
  res.json(await one('SELECT * FROM products WHERE code = ?', [code]));
}));

app.put('/api/products/:code/components', requirePermission('standards:write'), asyncHandler(async (req, res) => {
  const code = String(req.params.code);
  const existing = await one('SELECT code FROM products WHERE code = ?', [code]);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const items = Array.isArray(req.body?.components) ? req.body.components : [];

  try {
    await transaction(async (tx) => {
      await tx.run('DELETE FROM product_components WHERE product_code = ?', [code]);
      let i = 0;
      for (const it of items) {
        const t = it.component_type === 'free_text' ? 'free_text' : 'article';
        const qty = Number(it.qty_per_assembly);
        if (!Number.isFinite(qty) || qty <= 0) throw new Error('qty_per_assembly must be > 0');
        const uom = it.uom != null ? String(it.uom).trim() : null;
        if (t === 'article') {
          const ccode = String(it.component_code || '').trim();
          if (!ccode) throw new Error('component_code required for article component');
          const an = await tx.one('SELECT name FROM articles WHERE code = ?', [ccode]);
          await tx.run(
            `INSERT INTO product_components (
              product_code, component_type, component_code, component_name, component_text, qty_per_assembly, uom, sort_order
            ) VALUES (?,?,?,?,?,?,?,?)`,
            [code, t, ccode, an?.name || it.component_name || null, null, qty, uom, i++]
          );
        } else {
          const text = String(it.component_text || '').trim();
          if (!text) throw new Error('component_text required for free_text component');
          await tx.run(
            `INSERT INTO product_components (
              product_code, component_type, component_code, component_name, component_text, qty_per_assembly, uom, sort_order
            ) VALUES (?,?,?,?,?,?,?,?)`,
            [code, t, null, null, text, qty, uom, i++]
          );
        }
      }
    });
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
  const components = await all(
    'SELECT * FROM product_components WHERE product_code = ? ORDER BY sort_order, id'
  , [code]);
  res.json({ ok: true, components });
}));
}
