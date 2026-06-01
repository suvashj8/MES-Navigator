import GradeBadge from '../../../components/GradeBadge';
import { labels } from '../../../labels';
import type { DailyEntry } from '../../../api';

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
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800">
      <table className="w-full text-sm table-fixed">
        <colgroup>
          <col className="w-14" />
          <col className="w-[22%]" />
          <col className="w-20" />
          <col className="w-[28%]" />
          <col className="w-12" />
          <col className="w-14" />
          <col className="w-20" />
          <col className="w-28" />
          <col className="w-40" />
          {canDelete && <col className="w-14" />}
        </colgroup>
        <thead className="bg-slate-900 text-slate-400 text-left">
          <tr>
            <th className="p-3 whitespace-nowrap">{labels.regNo.en}</th>
            <th className="p-3 whitespace-nowrap">{labels.worker.en}</th>
            <th className="p-3 whitespace-nowrap">{labels.product.en}</th>
            <th className="p-3 whitespace-nowrap">{labels.costCenter.en}</th>
            <th className="p-3 text-right whitespace-nowrap">Qty</th>
            <th className="p-3 whitespace-nowrap">Grade</th>
            <th className="p-3 whitespace-nowrap">Entered by</th>
            <th className="p-3 whitespace-nowrap">Time</th>
            <th className="p-3 whitespace-nowrap">Updated</th>
            {canDelete && <th className="p-3 whitespace-nowrap" />}
          </tr>
        </thead>
        <tbody>
          {entries.length === 0 ? (
            <tr>
              <td colSpan={colCount} className="p-6 text-center text-slate-500">
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
                <td className="p-3">{e.reg_no}</td>
                <td className="p-3 truncate">{e.staff_name}</td>
                <td className="p-3 font-mono text-xs">{e.prod_code}</td>
                <td className="p-3 text-xs text-slate-400 truncate">{e.cost_center_name || e.cost_center_code}</td>
                <td className="p-3 text-right font-medium">{e.quantity}</td>
                <td className="p-3">
                  <GradeBadge grade={e.grade} />
                </td>
                <td className="p-3 text-xs text-slate-400">{e.entered_by || '—'}</td>
                <td className="p-3 text-xs text-slate-400 whitespace-nowrap">{e.created_at || '—'}</td>
                <td className="p-3 text-xs text-slate-400 whitespace-nowrap">
                  {e.updated_at ? (
                    <>
                      {e.updated_by ? <span className="text-slate-300">{e.updated_by}</span> : 'Updated'}
                      <span className="ml-2 text-slate-500">{e.updated_at}</span>
                    </>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>
                {canDelete && (
                  <td className="p-3">
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
