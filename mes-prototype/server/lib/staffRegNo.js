/** Display staff registration as BFL-01, BFL-02, … */
export function formatStaffRegNo(regNo) {
  if (regNo == null || !Number.isFinite(Number(regNo))) return '—';
  const n = Number(regNo);
  if (n <= 0) return String(regNo);
  return `BFL-${String(n).padStart(2, '0')}`;
}

/** Strip BFL- prefix for numeric DB search. Returns [numericPart, originalQuery]. */
export function regNoSearchTerms(q) {
  const s = String(q || '').trim();
  if (!s) return { like: '%', numeric: null };
  const m = s.match(/^BFL-?(\d+)$/i);
  if (m) return { like: `%${m[1]}%`, numeric: Number(m[1]) };
  return { like: `%${s}%`, numeric: /^\d+$/.test(s) ? Number(s) : null };
}
