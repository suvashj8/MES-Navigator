export function assertPersonName(name) {
  const s = String(name ?? '').trim();
  if (s.length < 2) {
    const err = new Error('Name is required');
    err.status = 400;
    throw err;
  }
  if (/[\d-]/.test(s) || !/^[\p{L}][\p{L}\s.']*$/u.test(s)) {
    const err = new Error('Name must use letters only (no numbers or minus signs)');
    err.status = 400;
    throw err;
  }
  return s;
}
