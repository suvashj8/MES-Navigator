import { one, all } from '../db.js';
import { assertNonNegative } from '../validateNumbers.js';

export async function getProductMasterByCode(code) {
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

export function normalizeVatCategory(v) {
  const s = String(v || '').trim();
  if (s === 'standard_13' || s === 'zero_0' || s === 'exempt') return s;
  return null;
}

export function asNullableText(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

export function asNullableNumber(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

export function asBoolInt(v) {
  return v ? 1 : 0;
}

export function splitProductMasterPayload(body) {
  const b = body || {};
  const accountMapping = Array.isArray(b.accountMapping) ? b.accountMapping : undefined;
  const exciseMappings = Array.isArray(b.exciseMappings) ? b.exciseMappings : undefined;
  const { accountMapping: _a, exciseMappings: _e, ...product } = b;
  return { product, accountMapping, exciseMappings };
}

export async function replaceProductAccountMapping(tx, productId, rows) {
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

export async function replaceProductExciseMapping(tx, productId, rows) {
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

export async function getProductMasterBundle(id) {
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

export function buildProductMasterCsv(bundle) {
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
