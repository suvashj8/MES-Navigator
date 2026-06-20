/**
 * Grading formula from reference Sheet5 (bed for life.xlsx)
 */
import { one } from './db.js';
import { calculateGradeMetrics } from './lib/gradingFormula.js';

export function calculateGrade(quantity, standard) {
  return calculateGradeMetrics(quantity, standard);
}

export async function findStandard(prodCode, costCenterCode, entryDate, department) {
  const date = entryDate || '9999-12-31';
  if (costCenterCode) {
    const byCc = await one(
      `SELECT * FROM grading_standards
       WHERE prod_code = ? AND cost_center_code = ?
       AND (effective_date IS NULL OR effective_date <= ?)
       ORDER BY effective_date DESC NULLS LAST
       LIMIT 1`,
      [prodCode, costCenterCode, date]
    );
    if (byCc) return byCc;
  }
  if (department) {
    return one(
      `SELECT * FROM grading_standards
       WHERE prod_code = ? AND department = ?
       AND (effective_date IS NULL OR effective_date <= ?)
       ORDER BY effective_date DESC NULLS LAST
       LIMIT 1`,
      [prodCode, department, date]
    );
  }
  return null;
}
