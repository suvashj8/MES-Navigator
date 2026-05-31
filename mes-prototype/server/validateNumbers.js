/**
 * Reject negative numeric values from API payloads (zero is allowed).
 */
export function assertNonNegative(fieldName, value) {
  if (value == null || value === '') return;
  const n = Number(value);
  if (!Number.isFinite(n)) return;
  if (n < 0) {
    const err = new Error(`${fieldName} cannot be negative`);
    err.status = 400;
    throw err;
  }
}

export function assertNonNegativeFields(pairs) {
  for (const [name, value] of pairs) {
    assertNonNegative(name, value);
  }
}
