import { useEffect, useId, useRef, useState } from 'react';
import ModalCloseButton from './ModalCloseButton';
import { formatAdSlash, parseAdSlash } from '../utils/formatDateTime';

type Props = {
  value: string;
  onChange: (iso: string) => void;
  className?: string;
  placeholder?: string;
  title?: string;
  required?: boolean;
  id?: string;
};

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const;

/** AD date field — displays DD/MM/YYYY; stores YYYY-MM-DD for the API. */
export default function AdDateField({
  value,
  onChange,
  className = '',
  placeholder = 'DD/MM/YYYY',
  title = 'Gregorian (AD) — DD/MM/YYYY',
  required,
  id,
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState(() => formatAdSlash(value));
  const [open, setOpen] = useState(false);

  const parsed = parseIsoDate(value);
  const view = parsed ?? todayIso();
  const [viewYear, setViewYear] = useState(view.year);
  const [viewMonth, setViewMonth] = useState(view.month);

  useEffect(() => {
    setText(formatAdSlash(value));
  }, [value]);

  useEffect(() => {
    const p = parseIsoDate(value);
    if (!p) return;
    setViewYear(p.year);
    setViewMonth(p.month);
  }, [value]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function commit(raw: string) {
    const parsedSlash = parseAdSlash(raw);
    if (parsedSlash === '') {
      onChange('');
      setText('');
      return;
    }
    if (parsedSlash === null) {
      setText(formatAdSlash(value));
      return;
    }
    onChange(parsedSlash);
    setText(formatAdSlash(parsedSlash));
  }

  function selectDay(day: number) {
    const iso = toIso(viewYear, viewMonth, day);
    onChange(iso);
    setText(formatAdSlash(iso));
    setOpen(false);
  }

  function shiftMonth(delta: number) {
    const d = new Date(viewYear, viewMonth - 1 + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth() + 1);
  }

  function shiftYear(delta: number) {
    setViewYear((y) => y + delta);
  }

  const grid = buildMonthGrid(viewYear, viewMonth);
  const selected = parsed;

  return (
    <div ref={rootRef} className="relative w-full min-w-0">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        title={title}
        required={required}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit(text);
          }
        }}
        className={`${className} w-full cursor-text pr-9`}
      />
      <button
        type="button"
        aria-label="Open AD calendar"
        title="Pick date (AD)"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={listId}
        className="absolute right-0 top-0 bottom-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground"
        onClick={() => setOpen((o) => !o)}
      >
        <CalendarIcon />
      </button>

      {open && (
        <div
          id={listId}
          role="dialog"
          aria-label="Gregorian (AD) calendar"
          className="mes-ad-calendar absolute left-0 z-50 mt-1 w-[18.5rem] min-w-[18.5rem] rounded-xl border border-slate-700 bg-slate-900 shadow-xl p-3"
        >
          <div className="flex justify-end mb-1">
            <ModalCloseButton
              onClick={() => setOpen(false)}
              className="h-8 w-8 text-sm"
              aria-label="Close calendar"
            />
          </div>
          <div className="flex items-center justify-between gap-1 mb-2">
            <button type="button" className="mes-bs-cal-nav" onClick={() => shiftYear(-1)} aria-label="Previous year">
              «
            </button>
            <button type="button" className="mes-bs-cal-nav" onClick={() => shiftMonth(-1)} aria-label="Previous month">
              ‹
            </button>
            <div className="flex-1 text-center text-xs font-semibold text-slate-200 px-1">
              {monthLabel(viewMonth)} {viewYear}
            </div>
            <button type="button" className="mes-bs-cal-nav" onClick={() => shiftMonth(1)} aria-label="Next month">
              ›
            </button>
            <button type="button" className="mes-bs-cal-nav" onClick={() => shiftYear(1)} aria-label="Next year">
              »
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-[10px] text-center text-slate-500 font-medium py-0.5">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {grid.map((cell, i) =>
              cell ? (
                <button
                  key={`${viewYear}-${viewMonth}-${cell.day}-${i}`}
                  type="button"
                  className={`mes-bs-cal-day ${
                    selected &&
                    selected.year === viewYear &&
                    selected.month === viewMonth &&
                    selected.day === cell.day
                      ? 'mes-bs-cal-day--selected'
                      : ''
                  }`}
                  onClick={() => selectDay(cell.day)}
                >
                  {cell.day}
                </button>
              ) : (
                <span key={`empty-${i}`} className="mes-bs-cal-day mes-bs-cal-day--empty" aria-hidden />
              )
            )}
          </div>

          <div className="mt-2 pt-2 border-t border-slate-800 flex justify-between gap-2">
            <button
              type="button"
              className="text-[11px] text-amber-400/90 hover:text-amber-300 font-medium"
              onClick={() => {
                const t = todayIso();
                setViewYear(t.year);
                setViewMonth(t.month);
                const iso = toIso(t.year, t.month, t.day);
                onChange(iso);
                setText(formatAdSlash(iso));
                setOpen(false);
              }}
            >
              Today
            </button>
            <button
              type="button"
              className="text-[11px] text-slate-500 hover:text-slate-300"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function parseIsoDate(iso: string | null | undefined) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return { year: y, month: m, day: d };
}

function todayIso() {
  const t = new Date();
  return { year: t.getFullYear(), month: t.getMonth() + 1, day: t.getDate() };
}

function toIso(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function monthLabel(month: number) {
  return new Date(2000, month - 1, 1).toLocaleString('en-GB', { month: 'long' });
}

function buildMonthGrid(year: number, month: number) {
  const first = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startDay = first.getDay();
  const cells: ({ day: number } | null)[] = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push({ day });
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
