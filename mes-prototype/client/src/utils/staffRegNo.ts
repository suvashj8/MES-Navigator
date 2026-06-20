/** Display staff registration as BFL-01, BFL-02, … (Excel sheet "1" numeric reg + company prefix). */
export function formatStaffRegNo(regNo: number | null | undefined): string {
  if (regNo == null || !Number.isFinite(Number(regNo))) return '—';
  const n = Number(regNo);
  if (n <= 0) return String(regNo);
  return `BFL-${String(n).padStart(2, '0')}`;
}

/** Parse "BFL-01", "BFL01", or "1" → numeric reg for API / database. */
export function parseStaffRegNoInput(input: string): number | null {
  const s = String(input || '').trim();
  if (!s) return null;
  const prefixed = s.match(/^BFL-?(\d+)$/i);
  if (prefixed) return Number(prefixed[1]);
  if (/^\d+$/.test(s)) return Number(s);
  return null;
}

/** Prefer API `reg_display`, else format as BFL-01. */
export function displayStaffRegNo(s: { reg_no: number; reg_display?: string }): string {
  return s.reg_display ?? formatStaffRegNo(s.reg_no);
}

/** Next sequential BFL reg after the highest positive reg_no in the list. */
export function nextStaffRegNo(staff: { reg_no: number }[]): string {
  const max = staff.reduce((m, s) => {
    const n = Number(s.reg_no);
    return Number.isFinite(n) && n > 0 && n > m ? n : m;
  }, 0);
  return formatStaffRegNo(max + 1);
}

/** Match search box against name or BFL-formatted reg. */
export function staffRegMatchesQuery(regNo: number, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const numeric = String(regNo);
  const formatted = formatStaffRegNo(regNo).toLowerCase();
  const compact = formatted.replace('-', '');
  return numeric.includes(q) || formatted.includes(q) || compact.includes(q);
}
