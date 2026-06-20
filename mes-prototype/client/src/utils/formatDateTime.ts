/** Nepal Standard Time (UTC+5:45), no "Z" / UTC suffix in display. */
export const NEPAL_TIME_ZONE = 'Asia/Kathmandu';

const nepalDateTimeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: NEPAL_TIME_ZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: true,
});

const nepalTimeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: NEPAL_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: true,
});

/**
 * Show an API/DB timestamp in Nepal local wall-clock time (readable, no Zulu suffix).
 */
/** Readable Gregorian label for an `YYYY-MM-DD` entry date. */
export function formatAdDisplay(ad: string | null | undefined): string {
  if (!ad || !String(ad).trim()) return '';
  const slash = formatAdSlash(ad);
  return slash ? `${slash} AD` : `${ad} AD`;
}

/** `YYYY-MM-DD` → `DD/MM/YYYY` for AD entry fields. */
export function formatAdSlash(iso: string | null | undefined): string {
  if (!iso || !String(iso).trim()) return '';
  const m = String(iso).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** Parse `DD/MM/YYYY` (or `DD-MM-YYYY`) → `YYYY-MM-DD`. Empty string → `''`. Invalid → `null`. */
export function parseAdSlash(input: string): string | null {
  const s = input.trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) return null;
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Current wall-clock time in Nepal (for live UI hints). */
export function formatNepalTimeNow(date: Date = new Date()): string {
  return nepalTimeFmt.format(date);
}

export function formatNepalDateTime(iso: string | null | undefined): string {
  if (!iso || !String(iso).trim()) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return nepalDateTimeFmt.format(d);
}
