import GradeBadge from '../../../components/GradeBadge';
import { labels } from '../../../labels';
import type { DailyEntry } from '../../../api';
import { formatNepalDateTime } from '../../../utils/formatDateTime';
import { formatStaffRegNo } from '../../../utils/staffRegNo';

export default function EntriesTable({
  entries,
  canDelete,
  entryRowClass,
  onDelete,
}: {
  entries: DailyEntry[];
  canDelete: boolean;
  entryRowClass: (id: number) => string;
  onDelete: (id: number) => void;
}) {
  const colCount = canDelete ? 10 : 9;
  const thCls = 'px-4 py-3 whitespace-nowrap text-left';
  const tdCls = 'px-4 py-3 align-middle';
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800">
      <table className="mes-entries-table w-full min-w-[56rem] text-sm">
        <thead className="bg-slate-900 text-slate-400 text-left">
          <tr>
            <th className={`${thCls} w-[6.5rem]`}>{labels.regNo.en}</th>
            <th className={`${thCls} min-w-[9rem]`}>{labels.worker.en}</th>
            <th className={`${thCls} w-[5.5rem]`}>{labels.product.en}</th>
            <th className={`${thCls} min-w-[8rem]`}>{labels.costCenter.en}</th>
            <th className={`${thCls} w-[4.5rem] text-right`}>Qty</th>
            <th className={`${thCls} w-[4.5rem]`}>Grade</th>
            <th className={`${thCls} min-w-[5.5rem]`}>Entered by</th>
            <th className={`${thCls} min-w-[12rem]`}>Saved (Nepal time)</th>
            <th className={`${thCls} min-w-[12rem]`}>Updated (Nepal time)</th>
            {canDelete && <th className={`${thCls} w-[4.5rem]`} />}
          </tr>
        </thead>
        <tbody>
          {entries.length === 0 ? (
            <tr>
              <td colSpan={colCount} className="p-6 mes-empty-hint">
                No entries for this date — add the first one above.
              </td>
            </tr>
          ) : (
            entries.map((e) => (
              <tr
                key={e.id}
                id={`entry-row-${e.id}`}
                className={`border-t border-slate-800 hover:bg-slate-900/50 transition-colors ${entryRowClass(e.id)}`}
              >
                <td className={`${tdCls} font-mono text-xs tabular-nums whitespace-nowrap border-r border-slate-800/60`}>
                  {formatStaffRegNo(e.reg_no)}
                </td>
                <td className={`${tdCls} truncate max-w-[14rem]`}>{e.staff_name}</td>
                <td className={`${tdCls} font-mono text-xs whitespace-nowrap`}>{e.prod_code}</td>
                <td className={`${tdCls} text-xs text-slate-400 truncate max-w-[12rem]`}>
                  {e.cost_center_name || e.cost_center_code}
                </td>
                <td className={`${tdCls} text-right font-medium tabular-nums`}>{e.quantity}</td>
                <td className={tdCls}>
                  <GradeBadge grade={e.grade} />
                </td>
                <td className={`${tdCls} text-xs text-slate-400`}>{e.entered_by || '—'}</td>
                <td className={`${tdCls} text-xs text-slate-400 whitespace-nowrap`} title={e.created_at || undefined}>
                  {formatNepalDateTime(e.created_at)}
                </td>
                <td className={`${tdCls} text-xs text-slate-400 whitespace-nowrap`} title={e.updated_at || undefined}>
                  {e.updated_at ? (
                    <>
                      {e.updated_by ? <span className="text-slate-300">{e.updated_by}</span> : 'Updated'}
                      <span className="ml-2 text-slate-500">{formatNepalDateTime(e.updated_at)}</span>
                    </>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>
                {canDelete && (
                  <td className={tdCls}>
                    <button
                      type="button"
                      onClick={() => onDelete(e.id)}
                      className="text-red-400 hover:text-red-300 text-xs"
                    >
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
