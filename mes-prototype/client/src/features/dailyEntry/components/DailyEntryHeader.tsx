import { labels } from '../../../labels';
import type { WorkflowStep } from '../utils';

export default function DailyEntryHeader({
  floorMode,
  showNepali,
  showNepaliSubtitles,
  onToggleNepali,
  nextStep,
  activityId,
  costCenter,
  prodCode,
  quantity,
}: {
  floorMode: boolean;
  showNepali: boolean;
  showNepaliSubtitles: boolean;
  onToggleNepali: (v: boolean) => void;
  nextStep: WorkflowStep;
  activityId: string;
  costCenter: string;
  prodCode: string;
  quantity: string;
}) {
  return (
    <header className={floorMode ? 'mb-4' : 'mb-8'}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className={floorMode ? 'text-xl font-bold' : 'text-2xl font-bold'}>
            {floorMode ? labels.floorEntry.en : labels.todayProductionEntry.en}
          </h2>
          {showNepali && (
            <p className="text-slate-500 text-xs mt-0.5">
              {floorMode ? labels.floorEntry.ne : labels.todayProductionEntry.ne}
            </p>
          )}
        </div>
        {!floorMode && (
          <label className="flex items-center gap-2 text-xs text-slate-400 select-none mt-1">
            <input
              type="checkbox"
              checked={showNepaliSubtitles}
              onChange={(e) => onToggleNepali(e.target.checked)}
            />
            Show Nepali subtitles
          </label>
        )}
      </div>
      <p className="text-slate-400 text-sm mt-1">Worker → job type → work station → product → quantity</p>
      <ol className="flex flex-wrap gap-2 mt-3 text-[10px] uppercase tracking-wide" aria-label="Entry steps">
        {(['activity', 'costCenter', 'product', 'quantity'] as const).map((step, i) => {
          const stepLabels = {
            activity: labels.stepActivity.en,
            costCenter: labels.stepCostCenter.en,
            product: labels.stepProduct.en,
            quantity: labels.stepQuantity.en,
          };
          const done =
            (step === 'activity' && activityId) ||
            (step === 'costCenter' && costCenter) ||
            (step === 'product' && prodCode) ||
            (step === 'quantity' && quantity);
          const current = nextStep === step;
          return (
            <li
              key={step}
              className={`px-2 py-0.5 rounded-full border ${
                current
                  ? 'border-amber-500 bg-amber-500/15 text-amber-300'
                  : done
                    ? 'border-emerald-700/50 bg-emerald-900/20 text-emerald-400'
                    : 'border-slate-700 text-slate-500'
              }`}
            >
              {i + 1}. {stepLabels[step]}
            </li>
          );
        })}
      </ol>
    </header>
  );
}
