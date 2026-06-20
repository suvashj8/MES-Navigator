import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveExcelPath } from './excelPath.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const DEFAULT_STAFF_EXCEL = resolveExcelPath();

/** Normalize staff name for matching Excel ↔ database. */
export function normalizeStaffName(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * Parse sheet "1" — columns: Registration Number, Staff Name, Department.
 * Rows without a registration number get the next sequential number after the highest explicit reg.
 */
export function parseStaffSheetRows(rows) {
  const withReg = [];
  const withoutReg = [];
  let maxReg = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const [reg, name, dept] = row;
    const cleanName = String(name || '').trim();
    if (!cleanName) continue;

    const entry = {
      regNo: null,
      name: cleanName,
      department: String(dept || 'General').trim() || 'General',
      normName: normalizeStaffName(cleanName),
    };

    if (reg !== '' && reg != null && !Number.isNaN(Number(reg))) {
      entry.regNo = Number(reg);
      maxReg = Math.max(maxReg, entry.regNo);
      withReg.push(entry);
    } else {
      withoutReg.push(entry);
    }
  }

  let next = maxReg + 1;
  for (const entry of withoutReg) {
    entry.regNo = next++;
    withReg.push(entry);
  }

  return withReg.sort((a, b) => a.regNo - b.regNo);
}

export function loadStaffFromExcel(excelPath = DEFAULT_STAFF_EXCEL) {
  const wb = XLSX.readFile(excelPath);
  const sheet = wb.Sheets['1'];
  if (!sheet) throw new Error('Sheet "1" not found in Excel workbook');
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  return parseStaffSheetRows(rows);
}
