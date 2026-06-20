/**
 * Re-sync grading_standards thresholds from Excel sheet "4" (Grading_Value).
 * Use after a bad migration or to refresh from bead for life (1).xlsx.
 */
import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';
import { all, run } from '../db.js';
import { resolveExcelPath } from '../lib/excelPath.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const excelPath = resolveExcelPath();

function fmtDate(v) {
  if (!v) return null;
  if (v instanceof Date && v.getFullYear() > 1901) return v.toISOString().slice(0, 10);
  return null;
}

async function main() {
  const wb = XLSX.readFile(excelPath);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['4'], { header: 1 });
  let updated = 0;
  let inserted = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[1]) continue;
    const [, prodCode, prodName, ccCode, ccName, stdMin, stdQty, cVal, bVal, aVal, aplus, effDate] = row;
    const code = String(prodCode).trim();
    const cc = String(ccCode).trim();
    const params = [
      String(prodName).trim(),
      String(ccName).trim(),
      Number(stdMin) || 420,
      Number(stdQty),
      Number(cVal),
      Number(bVal),
      Number(aVal),
      Number(aplus),
      Number(aplus),
      fmtDate(effDate),
    ];

    const existing = await all(
      `SELECT id FROM grading_standards WHERE prod_code = ? AND cost_center_code = ?`,
      [code, cc]
    );

    if (existing.length) {
      for (const r of existing) {
        await run(
          `UPDATE grading_standards SET
            prod_name = ?, cost_center_name = ?, standard_min = ?, std_qty = ?,
            c_value = ?, b_value = ?, a_value = ?, aplus_value = ?, aa_value = ?,
            effective_date = ?
           WHERE id = ?`,
          [...params, r.id]
        );
        updated++;
      }
    } else {
      await run(
        `INSERT INTO grading_standards (
          prod_code, prod_name, cost_center_code, cost_center_name,
          standard_min, std_qty, c_value, b_value, a_value, aplus_value, aa_value, effective_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [code, ...params]
      );
      inserted++;
    }
  }

  console.log(`Grading sync from sheet 4: ${updated} updated, ${inserted} inserted.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
