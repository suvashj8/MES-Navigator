import { assertNonNegativeFields } from '../validateNumbers.js';
import { getProductMasterByCode } from './productMasterHelpers.js';

export async function resolveGradingStandardProduct(body) {
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
