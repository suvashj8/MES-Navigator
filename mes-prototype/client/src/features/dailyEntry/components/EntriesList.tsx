import GradeBadge from '../../../components/GradeBadge';
import type { DailyEntry } from '../../../api';

export default function EntriesList({
  entries,
  entryRowClass,
  largeBadge = false,
  showAudit = false,
}: {
  entries: DailyEntry[];
  entryRowClass: (id: number) => string;
  largeBadge?: boolean;
  showAudit?: boolean;
}) {
  return (
    <ul className="space-y-2">
      {entries.map((e) => (
        <li
          key={e.id}
          id={`entry-row-${e.id}`}
          className={`flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl p-3 transition-colors ${entryRowClass(e.id)}`}
        >
          <div className="min-w-0">
            <p className="font-medium truncate">{e.staff_name}</p>
            <p className="text-xs text-slate-400 font-mono">
              {e.prod_code} · Qty {e.quantity}
              {e.entered_by && <span className="ml-2 text-slate-500">· {e.entered_by}</span>}
              {e.created_at && <span className="ml-2 text-slate-500">{e.created_at}</span>}
              {showAudit && e.updated_at && (
                <span className="ml-2 text-slate-600">
                  · upd {e.updated_by || '—'} {e.updated_at}
                </span>
              )}
            </p>
          </div>
          <GradeBadge grade={e.grade} size={largeBadge ? 'lg' : 'md'} />
        </li>
      ))}
    </ul>
  );
}
