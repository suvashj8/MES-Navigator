import FormField from '../../../components/FormField';
import StaffAvatar from '../../../components/StaffAvatar';
import { labels } from '../../../labels';
import type { Staff } from '../../../api';
import { controlCls } from '../utils';
import type { WorkflowStep } from '../utils';

type Props = {
  floorMode: boolean;
  showNepali: boolean;
  nextStep: WorkflowStep;
  staffId: string;
  staffList: Staff[];
  selectedWorker?: Staff;
  workerOpen: boolean;
  setWorkerOpen: (v: boolean | ((p: boolean) => boolean)) => void;
  workerQuery: string;
  setWorkerQuery: (v: string) => void;
  workerPickerRef: React.RefObject<HTMLDivElement | null>;
  filteredWorkers: Staff[];
  onSelectWorker: (id: string) => void;
};

export default function WorkerPickerField({
  floorMode,
  showNepali,
  nextStep,
  staffId,
  selectedWorker,
  workerOpen,
  setWorkerOpen,
  workerQuery,
  setWorkerQuery,
  workerPickerRef,
  filteredWorkers,
  onSelectWorker,
}: Props) {
  return (
    <FormField
      label={labels.worker.en}
      nepali={labels.worker.ne}
      showSubtitle={showNepali}
      reserveSubtitleLine={showNepali}
      required
      floorMode={floorMode}
      highlight={nextStep === 'worker'}
      hint={nextStep === 'worker' ? 'Select who did the work' : undefined}
      className="flex-[2] min-w-[12rem]"
    >
      <div ref={workerPickerRef} className="relative w-full">
        <button
          type="button"
          onClick={() => setWorkerOpen((v) => !v)}
          className={`${controlCls(floorMode)} flex items-center justify-between gap-3`}
          aria-haspopup="listbox"
          aria-expanded={workerOpen}
        >
          <span className="flex items-center gap-2 min-w-0">
            {selectedWorker ? (
              <StaffAvatar
                staffId={selectedWorker.id}
                hasPhoto={selectedWorker.has_photo}
                name={selectedWorker.name}
                className="h-7 w-7 rounded-md"
                imgClassName="h-full w-full object-cover"
              />
            ) : (
              <span className="h-7 w-7 rounded-md border border-slate-700 bg-slate-800 shrink-0 flex items-center justify-center text-xs font-semibold text-amber-200/80">
                W
              </span>
            )}
            <span className="truncate text-left">
              {selectedWorker
                ? `${selectedWorker.reg_no} — ${selectedWorker.name} (${selectedWorker.department})`
                : labels.selectWorker.en}
            </span>
          </span>
          <span className="text-slate-400">▾</span>
        </button>
        <input value={staffId} readOnly required className="sr-only" tabIndex={-1} aria-hidden />
        {workerOpen && (
          <div className="absolute z-20 w-full top-full mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
            <div className="p-2 border-b border-slate-800">
              <input
                value={workerQuery}
                onChange={(e) => setWorkerQuery(e.target.value)}
                placeholder="Search reg #, name, department..."
                className="w-full h-10 rounded-lg bg-slate-800 border border-slate-700 px-3 text-sm"
                autoFocus
              />
            </div>
            <ul className="max-h-72 overflow-y-auto" role="listbox" aria-label="Worker list">
              {filteredWorkers.length === 0 ? (
                <li className="p-3 text-sm text-slate-400">No workers found</li>
              ) : (
                filteredWorkers.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => onSelectWorker(String(s.id))}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-800"
                      role="option"
                      aria-selected={String(s.id) === staffId}
                    >
                      <StaffAvatar
                        staffId={s.id}
                        hasPhoto={s.has_photo}
                        name={s.name}
                        className="h-9 w-9 rounded-lg"
                        imgClassName="h-full w-full object-cover"
                      />
                      <span className="min-w-0">
                        <span className="block font-medium text-slate-200 truncate">{s.name}</span>
                        <span className="block text-xs text-slate-400 truncate">
                          <span className="font-mono">Reg {s.reg_no}</span>
                          <span className="mx-2">·</span>
                          {s.department}
                        </span>
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>
    </FormField>
  );
}
