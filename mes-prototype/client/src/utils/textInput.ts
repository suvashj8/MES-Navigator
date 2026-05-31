import type { KeyboardEvent } from 'react';

/** Letters and common name punctuation only — no digits or minus signs. */
export function sanitizePersonNameInput(raw: string): string {
  return raw
    .replace(/[\d-]/g, '')
    .replace(/[^\p{L}\s.']/gu, '')
    .replace(/\s+/g, ' ');
}

export function isValidPersonName(name: string): boolean {
  const s = name.trim();
  if (s.length < 2) return false;
  if (/[\d-]/.test(s)) return false;
  return /^[\p{L}][\p{L}\s.']*$/u.test(s);
}

export function blockPersonNameKey(e: KeyboardEvent) {
  if (e.key.length === 1 && /[\d-]/.test(e.key)) {
    e.preventDefault();
  }
}
