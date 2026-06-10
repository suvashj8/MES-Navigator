import { useEffect, useId, useRef, useState } from 'react';
import ModalCloseButton from './ModalCloseButton';
import {
  BS_MONTH_LABELS,
  buildBsMonthGrid,
  clampBsYearMonth,
  formatBsDate,
  maxBsYear,
  minBsYear,
  parseBsDate,
  todayBs,
} from '../utils/nepaliCalendar';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const;

type Props = {
  value: string;
  onChange: (bs: string) => void;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  placeholder?: string;
  title?: string;
};

export default function NepaliDatePicker({
  value,
  onChange,
  className = '',
  inputClassName = '',
  disabled = false,
  placeholder = 'YYYY-MM-DD',
  title = 'Nepali (Bikram Sambat) calendar',
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const parsed = parseBsDate(value);
  const initial = parsed ?? todayBs();
  const [viewYear, setViewYear] = useState(initial.year);
  const [viewMonth, setViewMonth] = useState(initial.month);

  useEffect(() => {
    const p = parseBsDate(value);
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

  function selectDay(day: number) {
    const bs = formatBsDate(viewYear, viewMonth, day);
    onChange(bs);
    setOpen(false);
  }

  function shiftMonth(delta: number) {
    const next = clampBsYearMonth(viewYear, viewMonth + delta);
    setViewYear(next.year);
    setViewMonth(next.month);
  }

  function shiftYear(delta: number) {
    const y = Math.min(maxBsYear(), Math.max(minBsYear(), viewYear + delta));
    setViewYear(y);
  }

  const grid = buildBsMonthGrid(viewYear, viewMonth);
  const selected = parsed;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          type="text"
          readOnly
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          title={title}
          className={`${inputClassName} w-full pr-9 cursor-pointer`}
          onClick={() => !disabled && setOpen((o) => !o)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              if (!disabled) setOpen((o) => !o);
            }
          }}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={listId}
        />
        <button
          type="button"
          disabled={disabled}
          className="absolute right-0 top-0 bottom-0 px-2.5 text-slate-400 hover:text-amber-400 disabled:opacity-50"
          onClick={() => !disabled && setOpen((o) => !o)}
          aria-label="Open Bikram Sambat calendar"
          tabIndex={-1}
        >
          <CalendarIcon />
        </button>
      </div>

      {open && (
        <div
          id={listId}
          role="dialog"
          aria-label="Bikram Sambat calendar"
          className="mes-bs-calendar absolute left-0 z-50 mt-1 w-[18.5rem] min-w-[18.5rem] rounded-xl border border-slate-700 bg-slate-900 shadow-xl p-3"
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
              {BS_MONTH_LABELS[viewMonth - 1]} {viewYear}
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
                const t = todayBs();
                setViewYear(t.year);
                setViewMonth(t.month);
                onChange(t.bs);
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
