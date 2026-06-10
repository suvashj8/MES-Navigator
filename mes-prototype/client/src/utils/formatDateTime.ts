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
  const m = String(ad).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return `${ad} AD`;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) return `${ad} AD`;
  return `${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(d)} AD`;
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
