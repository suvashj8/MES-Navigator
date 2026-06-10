import { all, one, run } from '../db.js';

/** Suggest a short department code from a display name (for migration). */
export function suggestDepartmentCode(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return 'DEPT';
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    const w = words[0].replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    return w.slice(0, 12) || 'DEPT';
  }
  const initials = words.map((w) => w.replace(/[^A-Za-z0-9]/g, '')[0] || '').join('').toUpperCase();
  return (initials || trimmed.slice(0, 8).toUpperCase()).slice(0, 12);
}

async function ensureUniqueCode(baseCode) {
  let code = baseCode.slice(0, 20);
  let n = 0;
  while (await one('SELECT id FROM departments WHERE code = ?', [code])) {
    n += 1;
    code = `${baseCode.slice(0, 16)}${n}`;
  }
  return code;
}

export function normalizeDepartmentCode(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .slice(0, 20);
}

export function normalizeDepartmentName(raw) {
  return String(raw || '').trim().replace(/\s+/g, ' ').slice(0, 120);
}

/** Import distinct department names from staff/users into departments (idempotent). */
export async function syncDepartmentsFromExisting() {
  const rows = await all(
    `
    SELECT DISTINCT trim(name) AS name FROM (
      SELECT department AS name FROM staff WHERE department IS NOT NULL AND trim(department) <> ''
      UNION
      SELECT department AS name FROM users WHERE department IS NOT NULL AND trim(department) <> ''
    ) t
    WHERE trim(name) <> ''
    ORDER BY name
    `
  );

  let added = 0;
  for (const { name } of rows) {
    const exists = await one('SELECT id FROM departments WHERE lower(name) = lower(?)', [name]);
    if (exists) continue;
    const code = await ensureUniqueCode(suggestDepartmentCode(name));
    await run('INSERT INTO departments (code, name, description) VALUES (?, ?, ?)', [
      code,
      name,
      'Imported from existing records',
    ]);
    added += 1;
  }
  return added;
}
