import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, type DailyGradingAuditRow, type DeletedDailyEntry } from '../api';
import DepartmentBanner from '../components/DepartmentBanner';
import PageShell from '../components/PageShell';
import Toast from '../components/Toast';
import TableSkeleton from '../components/skeleton/TableSkeleton';
import { useAuth } from '../hooks/useAuth';
import { useConfirm } from '../hooks/useConfirm';

export default function DeletedEntries() {
  const { can } = useAuth();
  const confirm = useConfirm();
  const [rows, setRows] = useState<DeletedDailyEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(50);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [auditOpenFor, setAuditOpenFor] = useState<number | null>(null);
  const [auditRows, setAuditRows] = useState<DailyGradingAuditRow[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const canHardDelete = can('users:manage');

  const showingFrom = useMemo(() => (total === 0 ? 0 : offset + 1), [offset, total]);
  const showingTo = useMemo(() => Math.min(total, offset + rows.length), [offset, rows.length, total]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.deletedDailyGrading({ offset, limit, q: q.trim() || undefined });
      setRows(r.rows || []);
      setTotal(r.total || 0);
      setOffset(r.offset || 0);
      setLimit(r.limit || limit);
    } catch (e) {
      setRows([]);
      setTotal(0);
      setToast(e instanceof Error ? e.message : 'Failed to load deleted entries');
    } finally {
      setLoading(false);
    }
  }, [offset, limit, q]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const t = setTimeout(() => {
      setOffset(0);
      void load();
    }, 250);
    return () => clearTimeout(t);
  }, [q, load]);

  async function restore(id: number) {
    await api.restoreDailyGrading(id);
    setToast('Restored');
    load();
  }

  async function hardDelete(id: number) {
    const ok = await confirm({
      title: 'Permanent delete',
      message: 'Permanently delete this entry? This cannot be undone.',
      confirmLabel: 'Delete forever',
      variant: 'danger',
    });
    if (!ok) return;
    await api.hardDeleteDailyGrading(id);
    setToast('Permanently deleted');
    load();
  }

  async function showHistory(id: number) {
    setAuditOpenFor(id);
    setAuditRows([]);
    setAuditLoading(true);
    try {
      const r = await api.dailyGradingAudit(id);
      setAuditRows(r.rows || []);
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Failed to load history');
    } finally {
      setAuditLoading(false);
    }
  }

  function fmtValues(s?: string | null) {
    if (!s) return null;
    try {
      const o = JSON.parse(s) as Record<string, unknown>;
      const qty = o.quantity != null ? `Qty ${String(o.quantity)}` : null;
      const grade = o.grade != null ? `Grade ${String(o.grade)}` : null;
      const remarks = o.remarks ? `Remarks "${String(o.remarks)}"` : null;
      return [qty, grade, remarks].filter(Boolean).join(' · ') || null;
    } catch {
      return s;
    }
  }

  return (
    <PageShell>
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} durationMs={2500} />}

      <header className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold">Deleted entries</h2>
          <p className="text-slate-400 text-sm mt-1">
            Recently deleted production entries. Restore if deleted by mistake.
          </p>
        </div>
        <div className="w-72">
          <label className="block text-xs text-slate-400 mb-1.5">Search worker</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Reg # or name"
            className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm outline-none focus:ring-2 focus:ring-amber-400/40"
          />
        </div>
      </header>

      <DepartmentBanner />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <p className="text-xs text-slate-500">
          Showing <strong className="text-slate-200">{showingFrom}-{showingTo}</strong> of{' '}
          <strong className="text-slate-200">{total}</strong>
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={offset <= 0 || loading}
            onClick={() => setOffset((v) => Math.max(0, v - limit))}
            className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={offset + limit >= total || loading}
            onClick={() => setOffset((v) => v + limit)}
            className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      {loading ? (
        <TableSkeleton columns={10} rows={8} label="Loading deleted entries" />
      ) : rows.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500">
          No deleted entries.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_400px] 2xl:grid-cols-[1fr_440px]">
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-left">
                <tr>
                  <th className="p-3 whitespace-nowrap">Deleted at</th>
                  <th className="p-3 whitespace-nowrap">Entry date</th>
                  <th className="p-3">Worker</th>
                  <th className="p-3">Product</th>
                  <th className="p-3">Work station</th>
                  <th className="p-3 text-right whitespace-nowrap">Qty</th>
                  <th className="p-3 whitespace-nowrap">Entered by</th>
                  <th className="p-3 whitespace-nowrap">Deleted by</th>
                  <th className="p-3 whitespace-nowrap">Created at</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-800 align-top">
                    <td className="p-3 text-xs text-slate-500 whitespace-nowrap">{r.deleted_at}</td>
                    <td className="p-3 text-xs text-slate-500 whitespace-nowrap">{r.entry_date}</td>
                    <td className="p-3">
                      <p className="font-medium truncate">{r.staff_name || `Staff #${r.staff_id}`}</p>
                      <p className="text-xs text-slate-500">
                        {r.reg_no != null ? `Reg ${r.reg_no}` : `ID ${r.staff_id}`}
                        {r.department ? ` · ${r.department}` : ''}
                      </p>
                    </td>
                    <td className="p-3">
                      <p className="font-mono text-xs text-amber-200/90">{r.prod_code}</p>
                      {r.prod_name && <p className="text-xs text-slate-500 truncate">{r.prod_name}</p>}
                    </td>
                    <td className="p-3">
                      <p className="font-mono text-xs">{r.cost_center_code}</p>
                      {r.cost_center_name && <p className="text-xs text-slate-500 truncate">{r.cost_center_name}</p>}
                    </td>
                    <td className="p-3 text-right font-semibold">{r.quantity}</td>
                    <td className="p-3 text-xs text-slate-500 whitespace-nowrap">{r.entered_by || '—'}</td>
                    <td className="p-3 text-xs text-slate-500 whitespace-nowrap">{r.deleted_by || '—'}</td>
                    <td className="p-3 text-xs text-slate-500 whitespace-nowrap">{r.created_at || '—'}</td>
                    <td className="p-3 whitespace-nowrap text-right">
                      <button
                        type="button"
                        onClick={() => showHistory(r.id)}
                        className="text-xs text-amber-300 hover:text-amber-200"
                      >
                        History
                      </button>
                      <span className="mx-2 text-slate-700">·</span>
                      <button
                        type="button"
                        onClick={() => restore(r.id)}
                        className="text-xs text-emerald-300 hover:text-emerald-200"
                      >
                        Restore
                      </button>
                      {canHardDelete && (
                        <>
                          <span className="mx-2 text-slate-700">·</span>
                          <button
                            type="button"
                            onClick={() => hardDelete(r.id)}
                            className="text-xs text-red-400 hover:text-red-300"
                          >
                            Delete forever
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <aside className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 h-fit">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-slate-200">
                {auditOpenFor != null ? `History for entry #${auditOpenFor}` : 'History'}
              </p>
              {auditOpenFor != null && (
                <button
                  type="button"
                  onClick={() => setAuditOpenFor(null)}
                  className="text-xs text-slate-400 hover:text-slate-200"
                >
                  Close
                </button>
              )}
            </div>

            {auditOpenFor == null ? (
              <p className="text-sm text-slate-500 mt-2">Select an entry and click “History”.</p>
            ) : auditLoading ? (
              <p className="text-slate-400 text-sm mt-2">Loading…</p>
            ) : auditRows.length === 0 ? (
              <p className="text-slate-500 text-sm mt-2">No history yet.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {auditRows.map((r) => (
                  <li key={r.id} className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2">
                    <p className="text-xs text-slate-400 whitespace-nowrap">
                      <span className="text-slate-200 font-medium">{r.action}</span>
                      {r.actor ? <span className="ml-2 text-slate-500">· {r.actor}</span> : null}
                      <span className="ml-2 text-slate-600">· {r.at}</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {fmtValues(r.old_values) ? (
                        <>
                          <span className="text-slate-400">Before:</span> {fmtValues(r.old_values)}
                          {'  '}<span className="text-slate-600">→</span>{' '}
                          <span className="text-slate-400">After:</span> {fmtValues(r.new_values) || '—'}
                        </>
                      ) : (
                        <span>{fmtValues(r.new_values) || '—'}</span>
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      )}
    </PageShell>
  );
}

