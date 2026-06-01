import { one, all, run, transaction } from '../db.js';
import { asyncHandler } from '../asyncHandler.js';
import { requirePermission } from '../middleware.js';
import { streamProductMasterPdf } from '../pdf.js';
import { cascadeProductMasterCodeChange } from '../productMasterLink.js';
import { assertNonNegative } from '../validateNumbers.js';
import {
  normalizeVatCategory,
  asNullableText,
  asNullableNumber,
  asBoolInt,
  splitProductMasterPayload,
  replaceProductAccountMapping,
  replaceProductExciseMapping,
  getProductMasterBundle,
  buildProductMasterCsv,
} from '../lib/productMasterHelpers.js';

export function registerProductMasterRoutes(app) {
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
}
