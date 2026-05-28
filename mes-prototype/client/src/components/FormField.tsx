import type { ReactNode } from 'react';

type Props = {
  label: string;
  /** Nepali subtitle under label (floor mode only) */
  nepali?: string;
  /** Show subtitle even when not in floor mode */
  showSubtitle?: boolean;
  /** Reserve the subtitle line height for alignment */
  reserveSubtitleLine?: boolean;
  required?: boolean;
  hint?: string;
  hintClassName?: string;
  className?: string;
  floorMode?: boolean;
  /** Amber ring on the control — marks the next step in the workflow */
  highlight?: boolean;
  children: ReactNode;
};

/** Label + control + fixed-height hint row so fields align in horizontal rows */
export default function FormField({
  label,
  nepali,
  showSubtitle,
  reserveSubtitleLine,
  required,
  hint,
  hintClassName = 'text-amber-400/80',
  className = '',
  floorMode,
  highlight,
  children,
}: Props) {
  const lblCls = floorMode ? 'floor-label' : 'text-xs text-slate-400 uppercase';
  const highlightRing = highlight
    ? '[&_select]:border-amber-500 [&_select]:ring-2 [&_select]:ring-amber-500/35 [&_input]:border-amber-500 [&_input]:ring-2 [&_input]:ring-amber-500/35'
    : '';

  const shouldShowSubtitle = showSubtitle ?? Boolean(floorMode);
  const reserveLine = reserveSubtitleLine ?? shouldShowSubtitle;

  return (
    <div className={`flex flex-col min-w-0 ${className}`}>
      <label
        className={`${lblCls} block shrink-0 mb-1.5 ${
          reserveLine ? 'min-h-[2.25rem]' : 'h-4 leading-4'
        } ${highlight ? 'text-amber-300' : ''}`}
      >
        <span>{label}</span>
        {required && ' *'}
        {reserveLine && (
          <span
            className={`block text-[10px] font-normal normal-case mt-0.5 leading-tight ${
              shouldShowSubtitle && nepali ? 'text-slate-500' : 'invisible select-none'
            }`}
            aria-hidden={!(shouldShowSubtitle && nepali)}
          >
            {(shouldShowSubtitle && nepali) || '\u00a0'}
          </span>
        )}
      </label>
      <div className={`${floorMode ? 'min-h-12' : 'min-h-10'} flex items-center w-full ${highlightRing}`}>
        {children}
      </div>
      <p
        className={`text-[10px] leading-4 h-4 mt-1 truncate ${hint ? hintClassName : 'invisible select-none'}`}
        aria-hidden={!hint}
      >
        {hint || '\u00a0'}
      </p>
    </div>
  );
}
