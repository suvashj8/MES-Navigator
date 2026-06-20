import GradeBadge from '../../../components/GradeBadge';
import { labels } from '../../../labels';
import type { DailyEntry } from '../../../api';
import EntriesTable from './EntriesTable';
import EntriesList from './EntriesList';

export default function DailyEntriesSection({
  date,
  floorMode,
  entriesView,
  setEntriesView,
  entries,
  entriesSorted,
  last3,
  entryRowClass,
  canDelete,
  exporting,
  offlineCount,
  onExport,
  onSyncOffline,
  onDelete,
}: {
  date: string;
  floorMode: boolean;
  entriesView: 'list' | 'table';
  setEntriesView: (v: 'list' | 'table') => void;
  entries: DailyEntry[];
  entriesSorted: DailyEntry[];
  last3: DailyEntry[];
  entryRowClass: (id: number) => string;
  canDelete: boolean;
  exporting: boolean;
  offlineCount: number;
  onExport: () => void;
  onSyncOffline: () => void;
  onDelete: (id: number) => void;
}) {
  return (
    <div className={floorMode || entriesView === 'list' ? 'space-y-2' : ''}>
      <div className="flex justify-between items-center mb-3">
        <div>
          <h3 className="font-semibold">Entries for {date}</h3>
          {offlineCount > 0 && (
            <button
              type="button"
              onClick={onSyncOffline}
              className="mt-1 text-xs text-amber-300 underline hover:no-underline"
              title="Sync saved offline entries"
            >
              Pending sync: {offlineCount} · Sync now
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-800 bg-slate-950/40 p-0.5">
            <button
              type="button"
              onClick={() => setEntriesView('list')}
              className={`px-2 py-1 text-[11px] rounded-md ${entriesView === 'list' ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-200'}`}
            >
              List
            </button>
            <button
              type="button"
              onClick={() => setEntriesView('table')}
              className={`px-2 py-1 text-[11px] rounded-md ${entriesView === 'table' ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Table
            </button>
          </div>
          <button
            type="button"
            onClick={onExport}
            disabled={exporting}
            className="text-xs px-3 py-1.5 rounded-lg border border-emerald-700/50 text-emerald-300 hover:bg-emerald-900/20 disabled:opacity-40"
          >
            {exporting ? 'Exporting...' : labels.exportCsv.en}
          </button>
        </div>
      </div>

      {floorMode ? (
        <div className="space-y-2">
          {entriesView === 'table' ? (
            <EntriesTable
              entries={entriesSorted}
              canDelete={canDelete}
              entryRowClass={entryRowClass}
              onDelete={onDelete}
            />
          ) : entriesSorted.length === 0 ? (
            <div className="mes-empty-hint py-4">No entries for this date — add the first one above.</div>
          ) : (
            <>
              <div className="sticky top-0 z-10 -mx-4 px-4 py-2 bg-slate-950/85 backdrop-blur border-b border-slate-800">
                <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-2">Last 3 entries</p>
                <EntriesList entries={last3} entryRowClass={entryRowClass} largeBadge />
              </div>
              <EntriesList entries={entriesSorted.slice(3)} entryRowClass={entryRowClass} />
            </>
          )}
        </div>
      ) : entriesView === 'table' ? (
        <EntriesTable entries={entries} canDelete={canDelete} entryRowClass={entryRowClass} onDelete={onDelete} />
      ) : (
        <div className="space-y-2">
          {entries.length === 0 ? (
            <div className="mes-empty-hint py-4">No entries for this date — add the first one above.</div>
          ) : (
            <EntriesList
              entries={[...entries].slice().reverse()}
              entryRowClass={entryRowClass}
              showAudit
            />
          )}
        </div>
      )}
    </div>
  );
}
