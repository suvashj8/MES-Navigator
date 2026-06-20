import { Link } from 'react-router-dom';
import GradeBadge from '../../../components/GradeBadge';
import { labels } from '../../../labels';
import type { GradePreviewResult, GradingStandard } from '../../../api';
import type { Activity } from '../../../api';

export default function GradePreviewSection({
  standard,
  preview,
  missingStandard,
  prodCode,
  selectedJobType,
  saveSuccess,
  error,
  floorMode,
  canOpenStandards,
}: {
  standard: GradingStandard | null;
  preview: GradePreviewResult | null;
  missingStandard: boolean;
  prodCode: string;
  selectedJobType?: Activity;
  saveSuccess: boolean;
  error: string;
  floorMode: boolean;
  canOpenStandards: boolean;
}) {
  return (
    <>
      {standard && (
        <div className="mes-notice-sky rounded-lg p-3 space-y-1.5">
          <p className="text-sm font-semibold truncate text-sky-950">{standard.prod_name}</p>
          <p className="text-sm font-medium text-sky-900">
            B: {standard.b_value} · A: {standard.a_value} · A+: {standard.aplus_value} · AA:{' '}
            {standard.aa_value ?? standard.aplus_value ?? 0}
          </p>
        </div>
      )}

      {preview && (
        <div className="mes-notice-emerald rounded-lg p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-emerald-950">{labels.calculatedGrade.en}</span>
            <GradeBadge grade={preview.grade} size={floorMode ? 'lg' : 'md'} />
            <span className="text-sm font-medium text-emerald-900 w-full sm:w-auto sm:ml-auto">
              W Min: <strong className="font-bold text-emerald-950">{preview.w_min}</strong>
              <span className="mx-2">·</span>
              P Hour: <strong className="font-bold text-emerald-950">{preview.p_hour}</strong>
            </span>
          </div>
        </div>
      )}

      {saveSuccess && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-700/50 bg-emerald-900/25 px-4 py-2.5 text-sm text-emerald-300">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </span>
          Entry saved — worker and product kept; enter the next quantity.
        </div>
      )}

      {missingStandard && prodCode && (
        <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm text-orange-200/90">
          <p className="font-medium">
            This product isn’t set up for{' '}
            <span className="font-semibold text-orange-100">{selectedJobType?.name || 'this job type'}</span>. Ask
            supervisor to add a grading rule.
          </p>
          {canOpenStandards ? (
            <p className="text-xs text-orange-200/80 mt-1">
              <Link to={`/standards?q=${encodeURIComponent(prodCode)}`} className="underline hover:no-underline">
                Open grading rules for {prodCode}
              </Link>
            </p>
          ) : (
            <p className="text-xs text-orange-200/70 mt-1">
              Tell the supervisor: product code <span className="font-mono">{prodCode}</span>
            </p>
          )}
        </div>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}
    </>
  );
}
