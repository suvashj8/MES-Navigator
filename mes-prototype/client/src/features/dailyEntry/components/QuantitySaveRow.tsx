import FormField from '../../../components/FormField';
import Spinner from '../../../components/Spinner';
import { labels } from '../../../labels';
import type { GradePreviewResult } from '../../../api';
import {
  blockNegativeNumberKey,
  sanitizeNonNegativeIntegerInput,
} from '../../../utils/numericInput';
import { controlCls } from '../utils';
import type { WorkflowStep } from '../utils';

export default function QuantitySaveRow({
  floorMode,
  showNepali,
  nextStep,
  prodCode,
  quantity,
  setQuantity,
  quantityEnabled,
  quantityInputRef,
  remarks,
  setRemarks,
  saving,
  saveSuccess,
  preview,
  beepOnSave,
  setBeepOnSave,
  showBeepToggle,
}: {
  floorMode: boolean;
  showNepali: boolean;
  nextStep: WorkflowStep;
  prodCode: string;
  quantity: string;
  setQuantity: (v: string) => void;
  quantityEnabled: boolean;
  quantityInputRef: React.RefObject<HTMLInputElement | null>;
  remarks: string;
  setRemarks: (v: string) => void;
  saving: boolean;
  saveSuccess: boolean;
  preview: GradePreviewResult | null;
  beepOnSave: boolean;
  setBeepOnSave: (v: boolean) => void;
  showBeepToggle: boolean;
}) {
  const minusBtn = floorMode
    ? `h-12 w-12 rounded-xl border border-slate-700 bg-slate-800 text-xl font-bold ${!quantityEnabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-700'}`
    : `h-10 w-10 rounded-lg border border-slate-700 bg-slate-800 text-lg font-bold ${!quantityEnabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-700'}`;

  return (
    <>
      <FormField
        label={labels.quantity.en}
        nepali={labels.quantity.ne}
        showSubtitle={showNepali}
        reserveSubtitleLine={showNepali}
        required
        floorMode={floorMode}
        highlight={nextStep === 'quantity'}
        hint={
          !prodCode
            ? labels.selectProductFirst.en
            : nextStep === 'quantity'
              ? labels.enterPieces.en
              : undefined
        }
        hintClassName={!prodCode ? 'text-orange-400' : 'text-amber-400/90'}
        className="w-full sm:w-32 shrink-0"
      >
        <div className="flex w-full items-center gap-2">
          <button
            type="button"
            onClick={() => setQuantity(String(Math.max(0, (parseInt(quantity || '0', 10) || 0) - 1)))}
            disabled={!quantityEnabled}
            className={minusBtn}
            aria-label="Decrease quantity"
          >
            −
          </button>
          <input
            ref={quantityInputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            required
            value={quantity}
            onChange={(e) => setQuantity(sanitizeNonNegativeIntegerInput(e.target.value))}
            onKeyDown={blockNegativeNumberKey}
            className={controlCls(floorMode, !quantityEnabled)}
            disabled={!quantityEnabled}
            placeholder={quantityEnabled ? '0' : '—'}
          />
          <button
            type="button"
            onClick={() => setQuantity(String((parseInt(quantity || '0', 10) || 0) + 1))}
            disabled={!quantityEnabled}
            className={minusBtn}
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>
      </FormField>

      {!floorMode && (
        <FormField
          label={labels.remarks.en}
          nepali={labels.remarks.ne}
          showSubtitle={showNepali}
          reserveSubtitleLine={showNepali}
          floorMode={floorMode}
          className="flex-1 min-w-[10rem] max-w-md"
        >
          <input value={remarks} onChange={(e) => setRemarks(e.target.value)} className={controlCls(floorMode)} />
        </FormField>
      )}

      <div className={`flex flex-col shrink-0 ${floorMode ? 'w-full md:w-auto' : 'sm:ml-auto'}`}>
        <span
          className={`block invisible select-none mb-1.5 ${floorMode ? 'min-h-[2.25rem]' : 'h-4 leading-4'}`}
          aria-hidden
        >
          <span>Save</span>
          {floorMode && <span className="block text-[10px] mt-0.5 leading-tight">{'\u00a0'}</span>}
        </span>
        <div className={floorMode ? 'min-h-12 flex items-center' : 'min-h-10 flex items-center'}>
          <button
            type="submit"
            disabled={saving || !preview}
            className={
              saveSuccess
                ? floorMode
                  ? 'w-full md:w-auto min-w-[12rem] h-12 md:h-10 px-8 rounded-2xl md:rounded-lg bg-emerald-600 text-white font-bold md:font-semibold text-lg md:text-base shadow-lg md:shadow-none disabled:opacity-100 fixed bottom-16 left-4 right-4 z-20 md:static'
                  : 'w-full sm:w-auto min-w-[12rem] h-10 px-8 rounded-lg bg-emerald-600 text-white font-semibold disabled:opacity-100'
                : floorMode
                  ? 'w-full md:w-auto min-w-[12rem] h-12 md:h-10 px-8 rounded-2xl md:rounded-lg bg-amber-500 text-slate-900 font-bold md:font-semibold text-lg md:text-base shadow-lg md:shadow-none disabled:opacity-40 fixed bottom-16 left-4 right-4 z-20 md:static'
                  : 'w-full sm:w-auto min-w-[12rem] h-10 px-8 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold disabled:opacity-40'
            }
          >
            {saving ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Spinner className="h-5 w-5" />
                Saving…
              </span>
            ) : saveSuccess ? (
              <span className="inline-flex items-center justify-center gap-2">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Saved
              </span>
            ) : preview ? (
              `Save — Grade ${preview.grade}`
            ) : (
              'Save Entry'
            )}
          </button>
        </div>
        {showBeepToggle && (
          <label className="mt-2 inline-flex items-center gap-2 text-xs text-slate-400 select-none">
            <input
              type="checkbox"
              checked={beepOnSave}
              onChange={(e) => {
                const v = e.target.checked;
                setBeepOnSave(v);
                localStorage.setItem('mes_beep_on_save', v ? '1' : '0');
              }}
              className="h-4 w-4 accent-amber-500"
            />
            Beep on save
          </label>
        )}
        <span className="h-4 mt-1 block invisible select-none" aria-hidden>
          &nbsp;
        </span>
      </div>
    </>
  );
}
