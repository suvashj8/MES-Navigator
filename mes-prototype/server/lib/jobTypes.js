export function normalizeJobCode(raw) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

export function normalizeJobName(raw) {
  return String(raw || '').trim().replace(/\s+/g, ' ').slice(0, 120);
}

export function normalizeWorkstationCode(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .slice(0, 20);
}

export function normalizeWorkstationName(raw) {
  return String(raw || '').trim().replace(/\s+/g, ' ').slice(0, 120);
}
