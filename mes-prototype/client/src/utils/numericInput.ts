import type { KeyboardEvent } from 'react';

/** Block minus and scientific notation in numeric fields. */
export function blockNegativeNumberKey(e: KeyboardEvent) {
  if (e.key === '-' || e.key === 'Minus' || e.key === 'e' || e.key === 'E') {
    e.preventDefault();
  }
}

/** Decimal input: digits and one dot; no minus sign. */
export function sanitizeNonNegativeDecimalInput(raw: string): string {
  let s = raw.replace(/-/g, '').replace(/[^\d.]/g, '');
  const dot = s.indexOf('.');
  if (dot !== -1) {
    s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, '');
  }
  return s;
}

/** Whole numbers only; no minus sign. */
export function sanitizeNonNegativeIntegerInput(raw: string): string {
  return raw.replace(/-/g, '').replace(/\D/g, '');
}

export function asNonNegativeNumberOrUndef(v: string): number | undefined {
  const s = v.trim();
  if (!s) return undefined;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}

export function parseNonNegativeNumber(v: string, fallback = 0): number {
  const n = Number(v.trim());
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

export const nonNegativeDecimalInputProps = {
  inputMode: 'decimal' as const,
  onKeyDown: blockNegativeNumberKey,
};
