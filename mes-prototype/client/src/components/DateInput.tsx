import { useEffect, useState } from 'react';
import { api } from '../api';

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

  async function onBsChange(bsVal: string) {
    const trimmed = bsVal.trim().replace(/^-+/, '');
    setBs(trimmed);
    if (!trimmed || trimmed.length < 8) return;
    try {
      const r = await api.nepaliDateBs(trimmed);
      onChange(r.ad);
      setBsDisplay(r.bs_display);
    } catch {
      /* invalid bs */
    }
  }

  function onBsBlur() {
    if (!bs) return;
    // Normalize common keyboard entry: YYYYMMDD -> YYYY-MM-DD
    const digits = bs.replace(/[^\d]/g, '');
    if (digits.length === 8) {
      const normalized = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
      if (normalized !== bs) onBsChange(normalized);
    }
  }

  const h = large || floorMode ? 'h-12' : 'h-10';
  const rounded = floorMode ? 'rounded-xl' : 'rounded-lg';
  const text = large || floorMode ? 'text-base' : 'text-sm';
  const pad = large || floorMode ? 'px-4' : 'px-3';
  const inputCls = `w-full ${h} ${rounded} ${pad} ${text} bg-slate-800 border border-slate-700`;
  const lblCls = floorMode ? 'floor-label' : 'text-xs text-slate-400 uppercase';
  const shouldShowSubtitle = showSubtitle ?? Boolean(floorMode);
  const reserveLine = reserveSubtitleLine ?? shouldShowSubtitle;

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
        <div className={`flex gap-2 ${floorMode ? 'min-h-12' : 'min-h-10'}`}>
          <input
            type="date"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`${inputCls} flex-1 min-w-0`}
            title="Gregorian (AD)"
          />
          <input
            type="text"
            value={bs}
            onChange={(e) => onBsChange(e.target.value)}
            onBlur={onBsBlur}
            className={`${inputCls} flex-1 min-w-0`}
            placeholder="YYYY-MM-DD (BS)"
            inputMode="numeric"
            autoComplete="off"
            title={bsDisplay || 'Nepali (Bikram Sambat) date (type BS)'}
          />
        </div>
        <p className={`text-[10px] leading-4 h-4 mt-1 truncate ${bsDisplay ? 'text-amber-400/80' : 'invisible'}`}>
          {bsDisplay || '\u00a0'}
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      {label && <label className={`${lblCls} block mb-1.5`}>{label}</label>}
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-[10px] text-slate-500 uppercase">BS</span>
        <input
          type="text"
          value={bs}
          onChange={(e) => onBsChange(e.target.value)}
          onBlur={onBsBlur}
          className={`${h} bg-slate-800/80 border border-slate-700 ${rounded} px-2 text-xs`}
          placeholder="YYYY-MM-DD"
          inputMode="numeric"
          autoComplete="off"
          title="Nepali (Bikram Sambat) date (type BS)"
        />
        {bsDisplay && <span className="text-xs text-amber-400/80">{bsDisplay}</span>}
      </div>
    </div>
  );
}
