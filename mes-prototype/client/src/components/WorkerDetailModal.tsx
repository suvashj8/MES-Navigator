import { useEffect, useState } from 'react';
import { api, downloadBlob, type DailyGradingAuditRow, type ScorecardParams, type WorkerDetail } from '../api';
import GradeBadge from './GradeBadge';
import { formatNepalDateTime } from '../utils/formatDateTime';
import Spinner from './Spinner';

export default function WorkerDetailModal({
  staffId,
  params,
  onClose,
}: {
  staffId: number;
  params: ScorecardParams;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<WorkerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [auditOpenFor, setAuditOpenFor] = useState<number | null>(null);
  const [auditRows, setAuditRows] = useState<DailyGradingAuditRow[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  useEffect(() => {
    api.workerDetail(staffId, params).then(setDetail).finally(() => setLoading(false));
  }, [staffId, params]);

  async function openAudit(entryId: number) {
    setAuditOpenFor(entryId);
    setAuditRows([]);
    setAuditLoading(true);
    try {
      const r = await api.dailyGradingAudit(entryId);
      setAuditRows(r.rows || []);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to load history');
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

  function printCard() {
    window.print();
  }

  async function exportPdf() {
    if (!detail) return;
    setPdfLoading(true);
    try {
      const blob = await api.exportWorkerPdf(staffId, params);
      downloadBlob(blob, `scorecard-${detail.staff.reg_no}.pdf`);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'PDF failed');
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-start justify-center p-4 z-50 overflow-y-auto print:bg-white print:p-0">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl my-4 print:border-0 print:shadow-none print:max-w-none">
        <div className="flex justify-between items-center p-5 border-b border-slate-800 print:border-slate-300">
          <h3 className="font-semibold text-lg print:text-black">Worker Scorecard</h3>
          <div className="flex gap-2 print:hidden">
            <button type="button" onClick={exportPdf} disabled={pdfLoading}
              className="px-3 py-1.5 text-sm border border-red-600/50 text-red-300 rounded-lg hover:bg-red-900/20">
              {pdfLoading ? '...' : 'PDF'}
            </button>
            <button type="button" onClick={printCard} className="px-3 py-1.5 text-sm border border-slate-600 rounded-lg hover:bg-slate-800">
              Print
            </button>
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none px-2">×</button>
          </div>
        </div>

        {loading ? (
          <div className="p-6 text-slate-300 flex items-center gap-3">
            <Spinner className="h-5 w-5 text-amber-300" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : detail ? (
          <div className="p-5 space-y-5 print:text-black">
            <div>
              <p className="text-xl font-bold print:text-black">{detail.staff.name}</p>
              <p className="text-sm text-slate-400 print:text-slate-600">
                Reg #{detail.staff.reg_no} · {detail.staff.department} · {detail.from} to {detail.to}
              </p>
            </div>

            {detail.summary ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MiniStat label="Avg Score" value={detail.summary.avg_score.toFixed(2)} />
                <MiniStat label="Rating" value={detail.summary.rating} />
                <MiniStat label="Entries" value={String(detail.summary.total_entries)} />
                <MiniStat label="Days" value={String(detail.summary.days_worked)} />
              </div>
            ) : (
              <p className="text-slate-500 text-sm">No summary for this period.</p>
            )}

            <div>
              <h4 className="text-sm font-medium text-slate-300 mb-2 print:text-black">Daily Entries</h4>
              {detail.entries.length === 0 ? (
                <p className="text-slate-500 text-sm">No entries in this period.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="text-slate-400 text-left border-b border-slate-800">
                    <tr>
                      <th className="py-2">Date</th>
                      <th className="py-2">Product</th>
                      <th className="py-2">Work station</th>
                      <th className="py-2 text-right">Qty</th>
                      <th className="py-2">Grade</th>
                      <th className="py-2">Entered by</th>
                      <th className="py-2">Saved (Nepal time)</th>
                      <th className="py-2">Updated (Nepal time)</th>
                      <th className="py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.entries.map((e) => (
                      <tr key={e.id} className="border-b border-slate-800/50">
                        <td className="py-2">{e.entry_date}</td>
                        <td className="py-2 font-mono">{e.prod_code}</td>
                        <td className="py-2 text-slate-400">{e.cost_center_name || e.cost_center_code}</td>
                        <td className="py-2 text-right">{e.quantity}</td>
                        <td className="py-2"><GradeBadge grade={e.grade} /></td>
                        <td className="py-2 text-slate-400">{e.entered_by || '—'}</td>
                        <td className="py-2 text-slate-400 whitespace-nowrap" title={e.created_at || undefined}>
                          {formatNepalDateTime(e.created_at)}
                        </td>
                        <td className="py-2 text-slate-400 whitespace-nowrap" title={e.updated_at || undefined}>
                          {e.updated_at ? `${e.updated_by || '—'} · ${formatNepalDateTime(e.updated_at)}` : '—'}
                        </td>
                        <td className="py-2 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openAudit(e.id)}
                            className="text-[11px] text-amber-300 hover:text-amber-200"
                          >
                            History
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {auditOpenFor != null && (
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 print:hidden">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-slate-200">History for entry #{auditOpenFor}</p>
                  <button
                    type="button"
                    onClick={() => setAuditOpenFor(null)}
                    className="text-xs text-slate-400 hover:text-slate-200"
                  >
                    Close
                  </button>
                </div>
                {auditLoading ? (
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
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-800/50 rounded-lg p-3 print:bg-slate-100">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
