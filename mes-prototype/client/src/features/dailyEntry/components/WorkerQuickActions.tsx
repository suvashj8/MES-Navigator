import type { Staff } from '../../../api';

export default function WorkerQuickActions({
  floorMode,
  staffId,
  ungradedCount,
  onPickNext,
  recentWorkerIds,
  staffList,
  onSelectWorker,
}: {
  floorMode: boolean;
  staffId: string;
  ungradedCount: number;
  onPickNext: () => void;
  recentWorkerIds: string[];
  staffList: Staff[];
  onSelectWorker: (id: string) => void;
}) {
  const btn = floorMode
    ? 'h-12 px-5 rounded-2xl bg-slate-800 border border-slate-700 text-slate-100 font-semibold hover:bg-slate-700 disabled:opacity-40'
    : 'h-10 px-4 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 font-semibold hover:bg-slate-700 disabled:opacity-40';
  const chip = floorMode ? 'h-12 px-4 rounded-2xl' : 'h-10 px-3 rounded-xl';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onPickNext}
        disabled={!staffId || ungradedCount === 0}
        className={btn}
        title="Jump to next worker not graded today"
      >
        Next worker →
      </button>
      {recentWorkerIds.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {recentWorkerIds
            .map((id) => staffList.find((s) => String(s.id) === id))
            .filter(Boolean)
            .slice(0, 5)
            .map((s) => (
              <button
                key={s!.id}
                type="button"
                onClick={() => onSelectWorker(String(s!.id))}
                className={`${chip} border ${
                  String(s!.id) === staffId
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
                    : 'border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800'
                }`}
                title={`Reg ${s!.reg_no}`}
              >
                <span className="text-sm font-semibold truncate max-w-[10rem] inline-block">{s!.name}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
