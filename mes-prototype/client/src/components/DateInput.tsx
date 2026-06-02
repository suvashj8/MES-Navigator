import { useEffect, useState } from 'react';
import { api } from '../api';
import NepaliDatePicker from './NepaliDatePicker';
import { formatAdDisplay } from '../utils/formatDateTime';

type Props = {
  label?: string;
  subtitle?: string;
  showSubtitle?: boolean;
  reserveSubtitleLine?: boolean;
  value: string;
  onChange: (ad: string) => void;
  className?: string;
  large?: boolean;
  /** Match FormField row height (AD + BS on one line, hint below) */
  aligned?: boolean;
  floorMode?: boolean;
};

export default function DateInput({
  label,
  subtitle,
  showSubtitle,
  reserveSubtitleLine,
  value,
  onChange,
  className = '',
  large,
  aligned,
  floorMode,
}: Props) {
  const [bs, setBs] = useState('');
  const [bsDisplay, setBsDisplay] = useState('');

  useEffect(() => {
    if (!value) return;
    api.nepaliDate(value).then((r) => {
      setBs(r.bs);
      setBsDisplay(r.bs_display);
    }).catch(() => setBsDisplay(''));
  }, [value]);

  async function applyBs(bsVal: string) {
    const trimmed = bsVal.trim();
    setBs(trimmed);
    if (!trimmed) return;
    try {
      const r = await api.nepaliDateBs(trimmed);
      onChange(r.ad);
      setBs(r.bs);
      setBsDisplay(r.bs_display);
    } catch {
      /* invalid bs */
    }
  }

  const h = large || floorMode ? 'h-12' : 'h-10';
  const rounded = floorMode ? 'rounded-xl' : 'rounded-lg';
  const text = large || floorMode ? 'text-base' : 'text-sm';
  const pad = large || floorMode ? 'px-4' : 'px-3';
  const inputCls = `mes-date-field w-full ${h} ${rounded} ${pad} ${text} bg-slate-800 border border-slate-700 text-slate-100 placeholder:text-slate-500`;
  const bsInputCls = `mes-date-field ${h} bg-slate-800 border border-slate-700 ${rounded} px-2 text-xs text-slate-100 placeholder:text-slate-500`;
  const lblCls = floorMode ? 'floor-label' : 'text-xs text-slate-400 uppercase';
  const shouldShowSubtitle = showSubtitle ?? Boolean(floorMode);
  const reserveLine = reserveSubtitleLine ?? shouldShowSubtitle;
  const adHint = formatAdDisplay(value);
  const hintCls = 'text-[10px] leading-4 h-4 mt-1 truncate';

  if (aligned) {
    return (
      <div className={className}>
        {label && (
          <label className={`${lblCls} block mb-1.5 shrink-0 ${reserveLine ? 'min-h-[2.25rem]' : 'h-4 leading-4'}`}>
            <span>{label}</span>
            {reserveLine && (
              <span
                className={`block text-[10px] font-normal normal-case mt-0.5 leading-tight ${
                  shouldShowSubtitle && subtitle ? 'text-slate-500' : 'invisible select-none'
                }`}
                aria-hidden={!(shouldShowSubtitle && subtitle)}
              >
                {(shouldShowSubtitle && subtitle) || '\u00a0'}
              </span>
            )}
          </label>
        )}
        <div
          className="grid gap-x-2 gap-y-0"
          style={{ gridTemplateColumns: 'minmax(8.25rem, 0.95fr) minmax(11.5rem, 1.15fr)' }}
        >
          <div className="min-w-0">
            <input
              type="date"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className={`${inputCls} min-w-0 w-full ${floorMode ? 'min-h-12' : 'min-h-10'}`}
              title="Gregorian (AD)"
            />
            <p className={`mes-date-ad-hint ${hintCls} ${adHint ? 'text-slate-400' : 'invisible select-none'}`}>
              {adHint || '\u00a0'}
            </p>
          </div>
          <div className="min-w-0">
            <NepaliDatePicker
              value={bs}
              onChange={(v) => void applyBs(v)}
              className="min-w-0 w-full"
              inputClassName={`${inputCls} min-w-0 w-full ${floorMode ? 'min-h-12' : 'min-h-10'}`}
              placeholder="YYYY-MM-DD (BS)"
              title={bsDisplay || 'Nepali (Bikram Sambat) calendar'}
            />
            <p className={`mes-date-bs-hint ${hintCls} ${bsDisplay ? 'text-amber-400/80' : 'invisible select-none'}`}>
              {bsDisplay || '\u00a0'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {label && <label className={`${lblCls} block mb-1.5`}>{label}</label>}
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
        title="Gregorian (AD)"
      />
      <div className="mt-2">
        <span className="mes-date-bs-label text-[10px] font-semibold text-slate-400 uppercase tracking-wide">BS</span>
        <NepaliDatePicker
          value={bs}
          onChange={(v) => void applyBs(v)}
          className="mt-1"
          inputClassName={bsInputCls}
          placeholder="YYYY-MM-DD"
          title={bsDisplay || 'Nepali (Bikram Sambat) calendar'}
        />
        {bsDisplay && (
          <p className="mes-date-bs-hint text-xs font-medium text-amber-400/80 mt-1">{bsDisplay}</p>
        )}
      </div>
    </div>
  );
}
