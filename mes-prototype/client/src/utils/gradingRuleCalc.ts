import type { StandardInput } from '../api';

const DEFAULT_STANDARD_MIN = 420;

export type ThresholdSet = Pick<
  StandardInput,
  'std_qty' | 'b_value' | 'c_value' | 'a_value' | 'aplus_value' | 'aa_value'
>;

export type GradePreview = {
  per_day_qty: number;
  working_min: number;
  c_time_min: number;
  p_hour: number;
  w_hour: number;
  w_min: number;
  grade: string;
};

/** Sheet4 default when Standard_Min = 420 (e.g. BL22274: C=Q-1, B=Q, A=Q+20, A+=Q+30). */
export function generateThresholds(quantity: number, standardMin = DEFAULT_STANDARD_MIN): ThresholdSet {
  const q = Math.max(0, quantity);
  const sm = Math.max(1, standardMin);
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

/** Sheet5 grade boundaries — must match server lib/gradingFormula.js */
function assignGrade(wMin: number, standard: StandardInput): string {
  const b = standard.b_value;
  const a = standard.a_value;
  const aplus = standard.aplus_value;
  if (wMin >= aplus) return 'AA';
  if (wMin >= a && wMin < aplus) return 'A';
  if (wMin >= b && wMin < a) return 'B';
  return 'C';
}

/** Same formula as server — preview for Add grading rule form. */
export function calculateGradePreview(quantity: number, standard: StandardInput): GradePreview | null {
  if (!Number.isFinite(quantity) || quantity < 0) return null;
  const perDayQty = standard.std_qty;
  if (!perDayQty || perDayQty <= 0) return null;

  const workingMin = standard.b_value;
  const cTimeMin = workingMin / perDayQty;
  const pHour = cTimeMin > 0 ? 60 / cTimeMin : 0;
  const wHour = quantity * (cTimeMin / 60);
  const wMin = wHour * 60;

  return {
    per_day_qty: round(perDayQty, 4),
    working_min: workingMin,
    c_time_min: round(cTimeMin, 4),
    p_hour: round(pHour, 2),
    w_hour: round(wHour, 4),
    w_min: round(wMin, 2),
    grade: assignGrade(wMin, standard),
  };
}

function round(n: number, d: number) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}
