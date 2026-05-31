import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import { one, all, run, transaction, initSchema } from './db.js';
import { asyncHandler } from './asyncHandler.js';
import { calculateGrade, findStandard } from './grading.js';
import { login, seedDefaultUsers, can } from './auth.js';
import { requireAuth, requirePermission } from './middleware.js';
import { getScorecards, getPeriodRange, getWorkerDetail, getDashboardTrend } from './reports.js';
import { resolveDepartment } from './scope.js';
import { adToBs, bsToAd, todayPair } from './nepaliDate.js';
import { streamScorecardsPdf, streamWorkerPdf, streamProductMasterPdf } from './pdf.js';
import {
  getGradingStandardsLinkSummary,
  linkGradingStandardsToProductMaster,
  cascadeProductMasterCodeChange,
} from './productMasterLink.js';
import { assertNonNegative, assertNonNegativeFields } from './validateNumbers.js';
import { assertPersonName } from './validateText.js';

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

async function writeDailyAudit({ entry_id, action, actor, oldRow, newRow }) {
  await run(
    `INSERT INTO daily_grading_audit (entry_id, action, actor, old_values, new_values)
     VALUES (?, ?, ?, ?, ?)`
  , [entry_id,
    action,
    actor || null,
    oldRow ? JSON.stringify(pickAuditValues(oldRow)) : null,
    newRow ? JSON.stringify(pickAuditValues(newRow)) : null]);
}

// --- Public auth ---
app.post('/api/auth/login', asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  const result = await login(username, password);
  if (!result) return res.status(401).json({ error: 'Invalid username or password' });
  res.json(result);
}));

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

// Apply auth to all routes below
app.use('/api', requireAuth);

app.get('/api/auth/scope', asyncHandler(async (req, res) => {
  const scope = resolveDepartment(req, req.query.department);
  res.json(scope);
}));

app.get('/api/nepali-date', asyncHandler(async (req, res) => {
  const { ad, bs } = req.query;
  if (ad) return res.json(adToBs(ad));
  if (bs) return res.json(bsToAd(bs));
  res.json(todayPair());
}));

// Staff ---
app.get('/api/staff', requirePermission('reports:read'), asyncHandler(async (req, res) => {
  const { q } = req.query;
  const { department } = resolveDepartment(req, req.query.department);
  const showAll = req.query.all === '1';
  if (showAll && !can(req.user.role, 'staff:write')) {
    return res.status(403).json({ error: 'Not allowed to view inactive staff' });
  }
  let sql = 'SELECT * FROM staff WHERE 1=1';
  const params = [];
  if (!showAll) {
    sql += ' AND is_active = 1';
  }
  if (department) { sql += ' AND department = ?'; params.push(department); }
  if (q) { sql += ' AND (name LIKE ? OR CAST(reg_no AS TEXT) LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
  sql += ' ORDER BY is_active DESC, reg_no';
  res.json(await all(sql, [...params]));
}));

app.post('/api/staff', requirePermission('staff:write'), asyncHandler(async (req, res) => {
  const { reg_no, name, department, photo_data } = req.body;
  const reg = Number(reg_no);
  if (!Number.isInteger(reg) || reg <= 0) {
    return res.status(400).json({ error: 'Registration number must be a positive integer' });
  }
  let cleanName;
  try {
    cleanName = assertPersonName(name);
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.message });
  }
  if (!department || String(department).trim().length < 1) {
    return res.status(400).json({ error: 'Department is required' });
  }
  const r = await run('INSERT INTO staff (reg_no, name, department, photo_data) VALUES (?, ?, ?, ?)', [reg,
    cleanName,
    String(department).trim(),
    photo_data || null,]);
  res.json(await one('SELECT * FROM staff WHERE id = ?', [r.lastInsertRowid]));
}));

app.patch('/api/staff/:id', requirePermission('staff:write'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const row = await one('SELECT * FROM staff WHERE id = ?', [id]);
  if (!row) return res.status(404).json({ error: 'Staff not found' });

  const { is_active } = req.body ?? {};
  if (is_active == null) {
    return res.status(400).json({ error: 'is_active is required' });
  }
  const nextActive = is_active ? 1 : 0;
  if (row.is_active === nextActive) {
    return res.json(row);
  }
  await run('UPDATE staff SET is_active = ? WHERE id = ?', [nextActive, id]);
  res.json(await one('SELECT * FROM staff WHERE id = ?', [id]));
}));

// Activities ---
app.get('/api/activities', requirePermission('reports:read'), asyncHandler(async (_, res) => {
  res.json(await all('SELECT * FROM activities ORDER BY code', []));
}));

// Articles ---
app.get('/api/articles', requirePermission('reports:read'), asyncHandler(async (req, res) => {
  const { q } = req.query;
  if (q) {
    return res.json(
      await all('SELECT * FROM articles WHERE display LIKE ? OR code LIKE ? LIMIT 50', [`%${q}%`, `%${q}%`])
    );
  }
  res.json(await all('SELECT * FROM articles ORDER BY code LIMIT 200', []));
}));

// Cost centers ---
app.get('/api/cost-centers', requirePermission('reports:read'), asyncHandler(async (req, res) => {
  const { activity_id } = req.query;
  if (activity_id) {
    return res.json(
      await all(`
        SELECT c.code, c.name FROM activity_cost_center_maps m
        JOIN cost_centers c ON c.code = m.cost_center_code
        WHERE m.activity_id = ?
        ORDER BY c.name
      `, [activity_id])
    );
  }
  res.json(await all('SELECT code, name FROM cost_centers ORDER BY name', []));
}));

async function getProductMasterByCode(code) {
  const c = String(code || '').trim();
  if (!c) return null;
  return one(
    `
      SELECT id, code, description, base_uom, type, product_type, product_nature, vat_category
      FROM product_master
      WHERE code = ?
    `,
    [c]
  );
}

async function resolveGradingStandardProduct(body) {
  const code = String(body?.prod_code || '').trim();
  const pm = await getProductMasterByCode(code);
  if (!pm) {
    const err = new Error(
      'Product must exist in Product Master. Add it under Setup → Product master first.'
    );
    err.status = 400;
    throw err;
  }
  assertNonNegativeFields([
    ['standard_min', body?.standard_min],
    ['std_qty', body?.std_qty],
    ['c_value', body?.c_value],
    ['b_value', body?.b_value],
    ['a_value', body?.a_value],
    ['aplus_value', body?.aplus_value],
  ]);
  return {
    ...body,
    prod_code: pm.code,
    prod_name: pm.description,
    product_master_id: pm.id,
  };
}

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

// ERP-style Product Master (rebuild) ---
function normalizeVatCategory(v) {
  const s = String(v || '').trim();
  if (s === 'standard_13' || s === 'zero_0' || s === 'exempt') return s;
  return null;
}

function asNullableText(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function asNullableNumber(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function asBoolInt(v) {
  return v ? 1 : 0;
}

function splitProductMasterPayload(body) {
  const b = body || {};
  const accountMapping = Array.isArray(b.accountMapping) ? b.accountMapping : undefined;
  const exciseMappings = Array.isArray(b.exciseMappings) ? b.exciseMappings : undefined;
  const { accountMapping: _a, exciseMappings: _e, ...product } = b;
  return { product, accountMapping, exciseMappings };
}

async function replaceProductAccountMapping(tx, productId, rows) {
  await tx.run('DELETE FROM product_account_mapping WHERE product_id = ?', [productId]);
  for (const r of rows) {
    await tx.run(
      `
      INSERT INTO product_account_mapping (
        product_id, group_name, subgroup_name,
        sales_account, sales_return_account,
        purchase_account, purchase_return_account,
        opening_stock_account, closing_stock_pl_account, stock_in_hand_account
      ) VALUES (?,?,?,?,?,?,?,?,?,?)
      `,
      [
        productId,
        asNullableText(r.group_name),
        asNullableText(r.subgroup_name),
        asNullableText(r.sales_account),
        asNullableText(r.sales_return_account),
        asNullableText(r.purchase_account),
        asNullableText(r.purchase_return_account),
        asNullableText(r.opening_stock_account),
        asNullableText(r.closing_stock_pl_account),
        asNullableText(r.stock_in_hand_account),
      ]
    );
  }
}

async function replaceProductExciseMapping(tx, productId, rows) {
  await tx.run('DELETE FROM product_excise_mappings WHERE product_id = ?', [productId]);
  for (const r of rows) {
    const rate = asNullableNumber(r.rate);
    if (Number.isNaN(rate)) throw new Error('rate must be a number');
    assertNonNegative('rate', rate);
    await tx.run(
      'INSERT INTO product_excise_mappings (product_id, excise_code, rate, notes) VALUES (?,?,?,?)',
      [productId, asNullableText(r.excise_code), rate, asNullableText(r.notes)]
    );
  }
}

app.get('/api/product-master', requirePermission('reports:read'), asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  const offset = Math.max(0, Number(req.query.offset || 0) || 0);
  const limit = Math.min(200, Math.max(1, Number(req.query.limit || 50) || 50));

  let where = 'WHERE 1=1';
  const params = [];
  if (q) {
    const like = `%${q}%`;
    where += ` AND (
      code LIKE ? OR description LIKE ? OR hs_code LIKE ? OR alternative_code LIKE ?
      OR product_harmonic LIKE ? OR location LIKE ?
      OR additional_desc1 LIKE ? OR additional_desc2 LIKE ? OR additional_desc3 LIKE ?
      OR additional_desc4 LIKE ? OR additional_desc5 LIKE ?
    )`;
    params.push(like, like, like, like, like, like, like, like, like, like, like);
  }

  const total = (await one(`SELECT COUNT(*) as c FROM product_master ${where}`, [...params]))?.c ?? 0;
  const rows = await all(
    `
      SELECT id, code, description, base_uom, type, product_type, product_nature, vat_category, hs_code, updated_at, created_at
      FROM product_master
      ${where}
      ORDER BY code
      LIMIT ? OFFSET ?
    `
  , [...params, limit, offset]);
  res.json({ rows, total, offset, limit });
}));

app.get('/api/product-master/:id', requirePermission('reports:read'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const product = await one('SELECT * FROM product_master WHERE id = ?', [id]);
  if (!product) return res.status(404).json({ error: 'Not found' });
  const accountMapping = await all(
    'SELECT * FROM product_account_mapping WHERE product_id = ? ORDER BY id'
  , [id]);
  const exciseMappings = await all(
    'SELECT * FROM product_excise_mappings WHERE product_id = ? ORDER BY id'
  , [id]);
  res.json({ product, accountMapping, exciseMappings });
}));

async function getProductMasterBundle(id) {
  const product = await one('SELECT * FROM product_master WHERE id = ?', [id]);
  if (!product) return null;
  const accountMapping = await all(
    'SELECT * FROM product_account_mapping WHERE product_id = ? ORDER BY id',
    [id]
  );
  const exciseMappings = await all(
    'SELECT * FROM product_excise_mappings WHERE product_id = ? ORDER BY id',
    [id]
  );
  return { product, accountMapping, exciseMappings };
}

function csvEscape(v) {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

function buildProductMasterCsv(bundle) {
  const { product, accountMapping, exciseMappings } = bundle;
  const lines = [];
  const kv = (section, field, value) => {
    lines.push([section, field, value].map(csvEscape).join(','));
  };
  lines.push('Section,Field,Value');
  const basic = [
    ['code', product.code],
    ['description', product.description],
    ['base_uom', product.base_uom],
    ['type', product.type],
    ['product_type', product.product_type],
    ['product_nature', product.product_nature],
    ['vat_category', product.vat_category],
    ['hs_code', product.hs_code],
    ['buy_price', product.buy_price],
    ['buy_disc_pct', product.buy_disc_pct],
    ['sales_price', product.sales_price],
    ['sales_disc_pct', product.sales_disc_pct],
    ['mrp', product.mrp],
    ['warranty_rate', product.warranty_rate],
    ['product_harmonic', product.product_harmonic],
  ];
  for (const [k, v] of basic) kv('Basic', k, v);
  const stock = [
    ['double_qty', product.double_qty ? 1 : 0],
    ['alt_uom', product.alt_uom],
    ['fix_conversion', product.fix_conversion ? 1 : 0],
    ['base_value', product.base_value],
    ['alt_value', product.alt_value],
    ['location', product.location],
    ['alternative_code', product.alternative_code],
    ['max_stock', product.max_stock],
    ['min_stock', product.min_stock],
    ['reorder_level', product.reorder_level],
    ['additional_desc_change', product.additional_desc_change ? 1 : 0],
    ['additional_desc1', product.additional_desc1],
    ['additional_desc2', product.additional_desc2],
    ['additional_desc3', product.additional_desc3],
    ['additional_desc4', product.additional_desc4],
    ['additional_desc5', product.additional_desc5],
  ];
  for (const [k, v] of stock) kv('Stock', k, v);
  lines.push('');
  const accCols = [
    'group_name',
    'subgroup_name',
    'sales_account',
    'sales_return_account',
    'purchase_account',
    'purchase_return_account',
    'opening_stock_account',
    'closing_stock_pl_account',
    'stock_in_hand_account',
  ];
  lines.push(['Account mapping', ...accCols].map(csvEscape).join(','));
  for (const row of accountMapping) {
    lines.push(['', ...accCols.map((c) => row[c])].map(csvEscape).join(','));
  }
  lines.push('');
  const excCols = ['excise_code', 'rate', 'notes'];
  lines.push(['Excise', ...excCols].map(csvEscape).join(','));
  for (const row of exciseMappings) {
    lines.push(['', ...excCols.map((c) => row[c])].map(csvEscape).join(','));
  }
  return lines.join('\n');
}

app.get('/api/product-master/:id/export.csv', requirePermission('reports:read'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const bundle = await getProductMasterBundle(id);
  if (!bundle) return res.status(404).json({ error: 'Not found' });
  const csv = buildProductMasterCsv(bundle);
  const code = String(bundle.product.code || id).replace(/[^a-zA-Z0-9_-]/g, '_');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="product-${code}.csv"`);
  res.send(csv);
}));

app.get('/api/product-master/:id/export.pdf', requirePermission('reports:read'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const bundle = await getProductMasterBundle(id);
  if (!bundle) return res.status(404).json({ error: 'Not found' });
  streamProductMasterPdf(res, bundle);
}));

app.post('/api/product-master', requirePermission('standards:write'), asyncHandler(async (req, res) => {
  const { product: productBody, accountMapping, exciseMappings } = splitProductMasterPayload(req.body);
  const b = productBody || {};
  const code = String(b.code || '').trim();
  const description = String(b.description || '').trim();
  if (!code) return res.status(400).json({ error: 'code required' });
  if (code.length > 35) return res.status(400).json({ error: 'code must be at most 35 characters' });
  if (!description) return res.status(400).json({ error: 'description required' });

  const vat_category = normalizeVatCategory(b.vat_category) || 'standard_13';

  const buy_price = asNullableNumber(b.buy_price);
  const buy_disc_pct = asNullableNumber(b.buy_disc_pct);
  const sales_price = asNullableNumber(b.sales_price);
  const sales_disc_pct = asNullableNumber(b.sales_disc_pct);
  const mrp = asNullableNumber(b.mrp);
  const warranty_rate = asNullableNumber(b.warranty_rate);
  const base_value = asNullableNumber(b.base_value);
  const alt_value = asNullableNumber(b.alt_value);
  const max_stock = asNullableNumber(b.max_stock);
  const min_stock = asNullableNumber(b.min_stock);
  const reorder_level = asNullableNumber(b.reorder_level);
  const exciseRate = asNullableNumber(b.excise_rate);

  for (const [k, v] of [
    ['buy_price', buy_price],
    ['buy_disc_pct', buy_disc_pct],
    ['sales_price', sales_price],
    ['sales_disc_pct', sales_disc_pct],
    ['mrp', mrp],
    ['warranty_rate', warranty_rate],
    ['base_value', base_value],
    ['alt_value', alt_value],
    ['max_stock', max_stock],
    ['min_stock', min_stock],
    ['reorder_level', reorder_level],
    ['excise_rate', exciseRate],
  ]) {
    if (Number.isNaN(v)) return res.status(400).json({ error: `${k} must be a number` });
    if (v != null && v < 0) return res.status(400).json({ error: `${k} cannot be negative` });
  }

  const createdBy = req.user?.username || null;
  const withMappings = accountMapping !== undefined || exciseMappings !== undefined;
  try {
    const insertedId = await transaction(async (tx) => {
      const r = await tx.run(
        `
          INSERT INTO product_master (
            code, description,
            base_uom, type, product_type, product_nature,
            vat_category, hs_code,
            buy_price, buy_disc_pct, sales_price, sales_disc_pct, mrp, warranty_rate,
            product_harmonic,
            double_qty, alt_uom, fix_conversion, base_value, alt_value,
            location, alternative_code,
            max_stock, min_stock, reorder_level,
            additional_desc_change, additional_desc1, additional_desc2, additional_desc3, additional_desc4, additional_desc5,
            created_at, updated_at, created_by, updated_by
          ) VALUES (
            ?, ?,
            ?, ?, ?, ?,
            ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?,
            ?, ?, ?, ?, ?,
            ?, ?,
            ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            datetime('now'), datetime('now'), ?, ?
          )
        `
      , [code,
        description,
        asNullableText(b.base_uom),
        asNullableText(b.type),
        asNullableText(b.product_type),
        asNullableText(b.product_nature),
        vat_category,
        asNullableText(b.hs_code),
        buy_price,
        buy_disc_pct,
        sales_price,
        sales_disc_pct,
        mrp,
        warranty_rate,
        asNullableText(b.product_harmonic),
        asBoolInt(b.double_qty),
        asNullableText(b.alt_uom),
        asBoolInt(b.fix_conversion),
        base_value,
        alt_value,
        asNullableText(b.location),
        asNullableText(b.alternative_code),
        max_stock,
        min_stock,
        reorder_level,
        asBoolInt(b.additional_desc_change),
        asNullableText(b.additional_desc1),
        asNullableText(b.additional_desc2),
        asNullableText(b.additional_desc3),
        asNullableText(b.additional_desc4),
        asNullableText(b.additional_desc5),
        createdBy,
        createdBy]);
      const id = Number(r.lastInsertRowid);
      if (accountMapping !== undefined) await replaceProductAccountMapping(tx, id, accountMapping);
      if (exciseMappings !== undefined) await replaceProductExciseMapping(tx, id, exciseMappings);
      return id;
    });
    if (withMappings) {
      const bundle = await getProductMasterBundle(insertedId);
      return res.status(201).json(bundle);
    }
    res.status(201).json(await one('SELECT * FROM product_master WHERE id = ?', [insertedId]));
  } catch (e) {
    return res.status(400).json({
      error: e.message?.toLowerCase().includes('unique') ? 'Product code already exists' : e.message,
    });
  }
}));

app.put('/api/product-master/:id', requirePermission('standards:write'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const existing = await one('SELECT * FROM product_master WHERE id = ?', [id]);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const { product: productBody, accountMapping, exciseMappings } = splitProductMasterPayload(req.body);
  const b = productBody || {};
  const withMappings = accountMapping !== undefined || exciseMappings !== undefined;

  const code = b.code != null ? String(b.code).trim() : existing.code;
  const description = b.description != null ? String(b.description).trim() : existing.description;
  if (!code) return res.status(400).json({ error: 'code required' });
  if (code.length > 35) return res.status(400).json({ error: 'code must be at most 35 characters' });
  if (!description) return res.status(400).json({ error: 'description required' });

  const vat_category = b.vat_category != null ? normalizeVatCategory(b.vat_category) : existing.vat_category;
  if (!vat_category) return res.status(400).json({ error: 'Invalid vat_category' });

  const num = (k) => (b[k] != null ? asNullableNumber(b[k]) : existing[k]);
  const buy_price = num('buy_price');
  const buy_disc_pct = num('buy_disc_pct');
  const sales_price = num('sales_price');
  const sales_disc_pct = num('sales_disc_pct');
  const mrp = num('mrp');
  const warranty_rate = num('warranty_rate');
  const base_value = num('base_value');
  const alt_value = num('alt_value');
  const max_stock = num('max_stock');
  const min_stock = num('min_stock');
  const reorder_level = num('reorder_level');

  for (const [k, v] of [
    ['buy_price', buy_price],
    ['buy_disc_pct', buy_disc_pct],
    ['sales_price', sales_price],
    ['sales_disc_pct', sales_disc_pct],
    ['mrp', mrp],
    ['warranty_rate', warranty_rate],
    ['base_value', base_value],
    ['alt_value', alt_value],
    ['max_stock', max_stock],
    ['min_stock', min_stock],
    ['reorder_level', reorder_level],
  ]) {
    if (Number.isNaN(v)) return res.status(400).json({ error: `${k} must be a number` });
    if (v != null && v < 0) return res.status(400).json({ error: `${k} cannot be negative` });
  }

  const updatedBy = req.user?.username || null;
  try {
    await transaction(async (tx) => {
      await tx.run(
        `
          UPDATE product_master SET
            code=?,
            description=?,
            base_uom=?,
            type=?,
            product_type=?,
            product_nature=?,
            vat_category=?,
            hs_code=?,
            buy_price=?,
            buy_disc_pct=?,
            sales_price=?,
            sales_disc_pct=?,
            mrp=?,
            warranty_rate=?,
            product_harmonic=?,
            double_qty=?,
            alt_uom=?,
            fix_conversion=?,
            base_value=?,
            alt_value=?,
            location=?,
            alternative_code=?,
            max_stock=?,
            min_stock=?,
            reorder_level=?,
            additional_desc_change=?,
            additional_desc1=?,
            additional_desc2=?,
            additional_desc3=?,
            additional_desc4=?,
            additional_desc5=?,
            updated_at=datetime('now'),
            updated_by=?
          WHERE id=?
        `
      , [code,
        description,
        b.base_uom != null ? asNullableText(b.base_uom) : existing.base_uom,
        b.type != null ? asNullableText(b.type) : existing.type,
        b.product_type != null ? asNullableText(b.product_type) : existing.product_type,
        b.product_nature != null ? asNullableText(b.product_nature) : existing.product_nature,
        vat_category,
        b.hs_code != null ? asNullableText(b.hs_code) : existing.hs_code,
        buy_price,
        buy_disc_pct,
        sales_price,
        sales_disc_pct,
        mrp,
        warranty_rate,
        b.product_harmonic != null ? asNullableText(b.product_harmonic) : existing.product_harmonic,
        b.double_qty != null ? asBoolInt(b.double_qty) : existing.double_qty,
        b.alt_uom != null ? asNullableText(b.alt_uom) : existing.alt_uom,
        b.fix_conversion != null ? asBoolInt(b.fix_conversion) : existing.fix_conversion,
        base_value,
        alt_value,
        b.location != null ? asNullableText(b.location) : existing.location,
        b.alternative_code != null ? asNullableText(b.alternative_code) : existing.alternative_code,
        max_stock,
        min_stock,
        reorder_level,
        b.additional_desc_change != null
          ? asBoolInt(b.additional_desc_change)
          : existing.additional_desc_change,
        b.additional_desc1 != null ? asNullableText(b.additional_desc1) : existing.additional_desc1,
        b.additional_desc2 != null ? asNullableText(b.additional_desc2) : existing.additional_desc2,
        b.additional_desc3 != null ? asNullableText(b.additional_desc3) : existing.additional_desc3,
        b.additional_desc4 != null ? asNullableText(b.additional_desc4) : existing.additional_desc4,
        b.additional_desc5 != null ? asNullableText(b.additional_desc5) : existing.additional_desc5,
        updatedBy,
        id]);
      if (accountMapping !== undefined) await replaceProductAccountMapping(tx, id, accountMapping);
      if (exciseMappings !== undefined) await replaceProductExciseMapping(tx, id, exciseMappings);
      await cascadeProductMasterCodeChange(id, existing.code, code, description);
    });
    if (withMappings) {
      const bundle = await getProductMasterBundle(id);
      return res.json(bundle);
    }
    res.json(await one('SELECT * FROM product_master WHERE id = ?', [id]));
  } catch (e) {
    return res.status(400).json({
      error: e.message?.toLowerCase().includes('unique') ? 'Product code already exists' : e.message,
    });
  }
}));

app.put('/api/product-master/:id/account-mapping', requirePermission('standards:write'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const existing = await one('SELECT id FROM product_master WHERE id = ?', [id]);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];

  try {
    await transaction(async (tx) => {
      await replaceProductAccountMapping(tx, id, rows);
    });
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  res.json({
    ok: true,
    rows: await all('SELECT * FROM product_account_mapping WHERE product_id = ? ORDER BY id', [id]),
  });
}));

app.put('/api/product-master/:id/excise-mapping', requirePermission('standards:write'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const existing = await one('SELECT id FROM product_master WHERE id = ?', [id]);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];

  try {
    await transaction(async (tx) => {
      await replaceProductExciseMapping(tx, id, rows);
    });
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  res.json({
    ok: true,
    rows: await all('SELECT * FROM product_excise_mappings WHERE product_id = ? ORDER BY id', [id]),
  });
}));

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

// Grading standards CRUD ---
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

// Daily grading ---
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

// Reports / Scorecards ---
app.get('/api/reports/scorecards', requirePermission('reports:read'), asyncHandler(async (req, res) => {
  const { period = 'weekly', anchor, from, to, staff_id } = req.query;
  const family = req.query.family ? String(req.query.family) : '';
  const group_name = req.query.group_name ? String(req.query.group_name) : '';
  const { department } = resolveDepartment(req, req.query.department);
  let range;
  if (from && to) {
    range = { from, to, label: `${from} to ${to}` };
  } else {
    range = getPeriodRange(period, anchor);
  }
  const cards = await getScorecards({
    from: range.from,
    to: range.to,
    department: department || undefined,
    staff_id: staff_id ? Number(staff_id) : undefined,
    family: family || undefined,
    group_name: group_name || undefined,
  });
  res.json({ period, ...range, scorecards: cards, scope: resolveDepartment(req, req.query.department) });
}));

app.get('/api/reports/worker/:staffId', requirePermission('reports:read'), asyncHandler(async (req, res) => {
  const { from, to, period = 'weekly', anchor } = req.query;
  const family = req.query.family ? String(req.query.family) : '';
  const group_name = req.query.group_name ? String(req.query.group_name) : '';
  let range;
  if (from && to) range = { from, to };
  else range = getPeriodRange(period, anchor);
  const detail = await getWorkerDetail(Number(req.params.staffId), {
    ...range,
    family: family || undefined,
    group_name: group_name || undefined,
  });
  if (!detail) return res.status(404).json({ error: 'Worker not found' });
  res.json(detail);
}));

// Dashboard ---
app.get('/api/dashboard', requirePermission('reports:read'), asyncHandler(async (req, res) => {
  const { date, not_graded_offset, not_graded_limit } = req.query;
  const today = date || new Date().toISOString().slice(0, 10);
  const { department } = resolveDepartment(req, req.query.department);
  const gradeDist = await all(
    'SELECT grade, COUNT(*) as count FROM daily_grading WHERE deleted_at IS NULL AND entry_date = ? GROUP BY grade'
  , [today]);
  const deptSummary = await all(`
    SELECT s.department, dg.grade, COUNT(*) as count
    FROM daily_grading dg JOIN staff s ON s.id = dg.staff_id
    WHERE dg.deleted_at IS NULL AND dg.entry_date = ? GROUP BY s.department, dg.grade
  `, [today]);

  const byFamily = await all(`
    SELECT COALESCE(p.family, '—') as family, COUNT(*) as count
    FROM daily_grading dg
    LEFT JOIN products p ON p.code = dg.prod_code
    WHERE dg.deleted_at IS NULL AND dg.entry_date = ?${department ? ' AND EXISTS (SELECT 1 FROM staff s WHERE s.id = dg.staff_id AND s.department = ?)' : ''}
    GROUP BY COALESCE(p.family, '—')
    ORDER BY count DESC
    LIMIT 10
  `, [...(department ? [today, department] : [today])]);

  const byGroup = await all(`
    SELECT COALESCE(p.group_name, '—') as group_name, COUNT(*) as count
    FROM daily_grading dg
    LEFT JOIN products p ON p.code = dg.prod_code
    WHERE dg.deleted_at IS NULL AND dg.entry_date = ?${department ? ' AND EXISTS (SELECT 1 FROM staff s WHERE s.id = dg.staff_id AND s.department = ?)' : ''}
    GROUP BY COALESCE(p.group_name, '—')
    ORDER BY count DESC
    LIMIT 10
  `, [...(department ? [today, department] : [today])]);
  const weekSummary = await getScorecards(getPeriodRange('weekly', today));

  const allStaff = await all(
    `SELECT id, reg_no, name, department FROM staff WHERE is_active=1${department ? ' AND department = ?' : ''} ORDER BY reg_no`
  , [...(department ? [department] : [])]);
  const gradedRows = await all(
    `SELECT DISTINCT dg.staff_id as id
     FROM daily_grading dg
     JOIN staff s ON s.id = dg.staff_id
     WHERE dg.deleted_at IS NULL AND dg.entry_date = ?${department ? ' AND s.department = ?' : ''}`,
    [...(department ? [today, department] : [today])]
  );
  const gradedIds = new Set(gradedRows.map((r) => r.id));
  const allNotGraded = allStaff.filter((s) => !gradedIds.has(s.id));
  const offset = Math.max(0, Number(not_graded_offset || 0) || 0);
  const limit = Math.min(50, Math.max(1, Number(not_graded_limit || 10) || 10));
  const workersNotGradedToday = allNotGraded.slice(offset, offset + limit);

  const productMasterCount = (await one('SELECT COUNT(*) as c FROM product_master', []))?.c ?? 0;
  const productsWithoutRulesCount =
    (await one(
      `
    SELECT COUNT(*) as c FROM product_master pm
    WHERE NOT EXISTS (
      SELECT 1 FROM grading_standards gs WHERE gs.prod_code = pm.code
    )
  `,
      []
    ))?.c ?? 0;

  res.json({
    date: today,
    todayEntries:
      (await one('SELECT COUNT(*) as c FROM daily_grading WHERE deleted_at IS NULL AND entry_date = ?', [today]))?.c ?? 0,
    staffCount: (await one('SELECT COUNT(*) as c FROM staff WHERE is_active=1', []))?.c ?? 0,
    standardsCount: (await one('SELECT COUNT(*) as c FROM grading_standards', []))?.c ?? 0,
    productMasterCount,
    productsWithoutRulesCount,
    gradeDist,
    deptSummary,
    byFamily,
    byGroup,
    trend: await getDashboardTrend(today, 7),
    weekWorkersGraded: weekSummary.length,
    weekEntries: weekSummary.reduce((s, c) => s + c.total_entries, 0),
    workersNotGradedToday,
    workersNotGradedTotal: allNotGraded.length,
    workersNotGradedOffset: offset,
    workersNotGradedLimit: limit,
  });
}));

// Missing standards inbox ---
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

app.get('/api/departments', requirePermission('reports:read'), asyncHandler(async (req, res) => {
  const scope = resolveDepartment(req, req.query.department);
  if (scope.locked && scope.department) {
    return res.json([scope.department]);
  }
  const deptRows = await all('SELECT DISTINCT department FROM staff ORDER BY department', []);
  res.json(deptRows.map((r) => r.department));
}));

// User management (admin) ---
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

// CSV export scorecards ---
app.get('/api/reports/scorecards/export', requirePermission('reports:read'), asyncHandler(async (req, res) => {
  const { period = 'weekly', anchor, from, to, staff_id } = req.query;
  const { department } = resolveDepartment(req, req.query.department);
  let range;
  if (from && to) range = { from, to, label: `${from} to ${to}` };
  else range = getPeriodRange(period, anchor);
  const cards = await getScorecards({
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
}));

// PDF export scorecards ---
app.get('/api/reports/scorecards/export.pdf', requirePermission('reports:read'), asyncHandler(async (req, res) => {
  const { period = 'weekly', anchor, from, to, staff_id } = req.query;
  const { department } = resolveDepartment(req, req.query.department);
  let range;
  if (from && to) range = { from, to, label: `${from} to ${to}` };
  else range = getPeriodRange(period, anchor);
  const cards = await getScorecards({
    from: range.from,
    to: range.to,
    department: department || undefined,
    staff_id: staff_id ? Number(staff_id) : undefined,
  });
  streamScorecardsPdf(res, { ...range, scorecards: cards });
}));

app.get('/api/reports/worker/:staffId/export.pdf', requirePermission('reports:read'), asyncHandler(async (req, res) => {
  const { from, to, period = 'weekly', anchor } = req.query;
  let range;
  if (from && to) range = { from, to };
  else range = getPeriodRange(period, anchor);
  const detail = await getWorkerDetail(Number(req.params.staffId), range);
  if (!detail) return res.status(404).json({ error: 'Worker not found' });
  if (req.user.role === 'supervisor' && req.user.department && detail.staff.department !== req.user.department) {
    return res.status(403).json({ error: 'Access denied for this department' });
  }
  streamWorkerPdf(res, detail);
}));

const PORT = process.env.PORT || 3001;

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

async function start() {
  await initSchema();
  await seedDefaultUsers();
  app.listen(PORT, () => console.log(`MES API running on http://localhost:${PORT}`));
}
start().catch((e) => {
  console.error(e);
  process.exit(1);
});
