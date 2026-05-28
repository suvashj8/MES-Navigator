/**
 * Grading formula from reference Sheet5 (bed for life.xlsx)
 */
export function calculateGrade(quantity, standard) {
  if (!standard || quantity == null || quantity < 0) {
    return { grade: null, error: 'Missing standard or quantity' };
  }

  const perDayQty = standard.std_qty;
  const workingMin = standard.b_value;
  const cTimeMin = workingMin / perDayQty;
  const pHour = cTimeMin > 0 ? 60 / cTimeMin : 0;
  const wHour = quantity * (cTimeMin / 60);
  const wMin = wHour * 60;

  let grade = 'C';
  if (wMin >= standard.aplus_value) grade = 'AA';
  else if (wMin >= standard.a_value) grade = 'A';
  else if (wMin >= standard.b_value) grade = 'B';
  else grade = 'C';

  return {
    per_day_qty: perDayQty,
    working_min: workingMin,
    c_time_min: round(cTimeMin, 4),
    p_hour: round(pHour, 2),
    w_hour: round(wHour, 4),
    w_min: round(wMin, 2),
    grade,
  };
}

function round(n, d) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

export function findStandard(db, prodCode, costCenterCode, entryDate) {
  return db
    .prepare(
      `SELECT * FROM grading_standards
       WHERE prod_code = ? AND cost_center_code = ?
       AND (effective_date IS NULL OR effective_date <= ?)
       ORDER BY effective_date DESC
       LIMIT 1`
    )
    .get(prodCode, costCenterCode, entryDate || '9999-12-31');
}
