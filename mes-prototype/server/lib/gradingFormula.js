/**
 * Grading formula — Sheet5, "bead for life (1).xlsx"
 *
 * Per Day Qty = Std_Qty (from Grading_Value / sheet 4)
 * Working Min = B_Value (from Grading_Value / sheet 4)
 * C Time Min = Working Min / Per Day Qty
 * P Hour = 60 / C Time Min
 * W Hour = quantity * (C Time Min / 60)
 * W Min = W Hour * 60
 *
 * Grade (when rule exists in Grading_Value):
 *   W Min < B_Value                         → C
 *   B_Value ≤ W Min < A_Value               → B
 *   A_Value ≤ W Min < Aplus_Value           → A
 *   W Min ≥ Aplus_Value                     → AA
 */

export function assignGrade(wMin, standard) {
  const b = Number(standard.b_value);
  const a = Number(standard.a_value);
  const aplus = Number(standard.aplus_value);
  if (wMin >= aplus) return 'AA';
  if (wMin >= a && wMin < aplus) return 'A';
  if (wMin >= b && wMin < a) return 'B';
  return 'C';
}

export function calculateGradeMetrics(quantity, standard) {
  if (!standard || quantity == null || quantity < 0) {
    return { grade: null, error: 'Missing standard or quantity' };
  }

  const perDayQty = Number(standard.std_qty);
  if (!Number.isFinite(perDayQty) || perDayQty <= 0) {
    return { grade: null, error: 'Invalid Per Day Qty (Std_Qty)' };
  }

  const workingMin = Number(standard.b_value);
  const cTimeMin = workingMin / perDayQty;
  const pHour = cTimeMin > 0 ? 60 / cTimeMin : 0;
  const wHour = quantity * (cTimeMin / 60);
  const wMin = wHour * 60;
  const grade = assignGrade(wMin, standard);

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

/** Default thresholds for Add grading rule (Sheet4 pattern when Standard_Min = 420). */
export function generateThresholdsFromQuantity(quantity, standardMin = 420) {
  const q = Math.max(0, Number(quantity));
  const sm = Math.max(1, Number(standardMin) || 420);
  const aBonus = Math.round(sm / 21);
  const aaBonus = Math.round(sm / 14);
  const aplus = q + aaBonus;
  return {
    std_qty: q,
    b_value: q,
    c_value: Math.max(0, q - 1),
    a_value: q + aBonus,
    aplus_value: aplus,
    aa_value: aplus,
  };
}

function round(n, d) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}
