import { assertNonNegativeFields } from '../validateNumbers.js';
import { getProductMasterByCode } from './productMasterHelpers.js';

function deptCostCenterCode(department) {
  const slug = String(department || '')
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return slug ? `D:${slug}` : 'D:GENERAL';
}

export async function resolveGradingStandardProduct(body) {
  const code = String(body?.prod_code || '').trim();
  const department = String(body?.department || '').trim();
  const pm = await getProductMasterByCode(code);
  if (!pm) {
    const err = new Error(
      'Product must exist in Product Master. Add it under Setup → Product master first.'
    );
    err.status = 400;
    throw err;
  }
  if (!department) {
    const err = new Error('Department is required.');
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
    ['aa_value', body?.aa_value],
  ]);
  const stdQty = Number(body?.std_qty);
  const bValue = Number(body?.b_value);
  const aaValue = body?.aa_value ?? body?.aplus_value ?? 0;
  const ccCode = String(body?.cost_center_code || '').trim() || deptCostCenterCode(department);
  const ccName = String(body?.cost_center_name || '').trim() || department;
  return {
    ...body,
    prod_code: pm.code,
    prod_name: pm.description,
    product_master_id: pm.id,
    department,
    cost_center_code: ccCode,
    cost_center_name: ccName,
    std_qty: stdQty > 0 ? stdQty : bValue > 0 ? bValue : 0,
    aplus_value: Number(body?.aplus_value) || 0,
    aa_value: Number(aaValue) || Number(body?.aplus_value) || 0,
  };
}
