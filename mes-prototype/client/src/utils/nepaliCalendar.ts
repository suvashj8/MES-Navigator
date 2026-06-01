import NepaliDate, { dateConfigMap } from 'nepali-date-converter';

/** Keys in `dateConfigMap` (month 1 = Baisakh) */
export const BS_CONFIG_MONTH_KEYS = [
  'Baisakh',
  'Jestha',
  'Asar',
  'Shrawan',
  'Bhadra',
  'Aswin',
  'Kartik',
  'Mangsir',
  'Poush',
  'Magh',
  'Falgun',
  'Chaitra',
] as const;

/** Display labels (aligned with server `nepaliDate.js`) */
export const BS_MONTH_LABELS = [
  'Baisakh',
  'Jestha',
  'Ashadh',
  'Shrawan',
  'Bhadra',
  'Ashwin',
  'Kartik',
  'Mangsir',
  'Poush',
  'Magh',
  'Falgun',
  'Chaitra',
] as const;

const BS_YEARS = Object.keys(dateConfigMap)
  .map((y) => Number(y))
  .filter((y) => !Number.isNaN(y))
  .sort((a, b) => a - b);

export function minBsYear() {
  return BS_YEARS[0] ?? 2000;
}

export function maxBsYear() {
  return BS_YEARS[BS_YEARS.length - 1] ?? 2090;
}

export function parseBsDate(bs: string): { year: number; month: number; day: number } | null {
  const m = bs.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1) return null;
  return { year, month, day };
}

export function formatBsDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function daysInBsMonth(year: number, month: number): number {
  const cfg = dateConfigMap[String(year)];
  if (!cfg || month < 1 || month > 12) return 30;
  const key = BS_CONFIG_MONTH_KEYS[month - 1];
  return cfg[key] ?? 30;
}

export function bsToAdString(bs: string): string | null {
  try {
    const nd = new NepaliDate(bs);
    const ad = nd.getAD();
    return `${ad.year}-${String(ad.month).padStart(2, '0')}-${String(ad.date).padStart(2, '0')}`;
  } catch {
    return null;
  }
}

export function bsDisplayFor(year: number, month: number, day: number) {
  const label = BS_MONTH_LABELS[month - 1] ?? `Month ${month}`;
  return `${label} ${day}, ${year} BS`;
}

export function todayBs(): { bs: string; year: number; month: number; day: number } {
  const nd = new NepaliDate();
  const year = nd.getYear();
  const month = nd.getMonth() + 1;
  const day = nd.getDate();
  return { bs: formatBsDate(year, month, day), year, month, day };
}

export type BsCalendarCell = { day: number } | null;

export function buildBsMonthGrid(year: number, month: number): BsCalendarCell[] {
  const total = daysInBsMonth(year, month);
  let startWeekday = 0;
  try {
    const first = new NepaliDate(formatBsDate(year, month, 1));
    startWeekday = first.getDay();
  } catch {
    startWeekday = 0;
  }
  const cells: BsCalendarCell[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= total; d++) cells.push({ day: d });
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function clampBsYearMonth(year: number, month: number) {
  let y = year;
  let m = month;
  if (y < minBsYear()) y = minBsYear();
  if (y > maxBsYear()) y = maxBsYear();
  while (m < 1) {
    m += 12;
    y -= 1;
  }
  while (m > 12) {
    m -= 12;
    y += 1;
  }
  if (y < minBsYear()) return { year: minBsYear(), month: 1 };
  if (y > maxBsYear()) return { year: maxBsYear(), month: 12 };
  return { year: y, month: m };
}
