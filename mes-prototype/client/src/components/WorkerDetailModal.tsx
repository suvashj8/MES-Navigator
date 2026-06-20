import { useEffect, useState } from 'react';
import { api, downloadBlob, type DailyGradingAuditRow, type ScorecardParams, type WorkerDetail } from '../api';
import GradeBadge from './GradeBadge';
import { formatNepalDateTime } from '../utils/formatDateTime';
import { formatStaffRegNo } from '../utils/staffRegNo';
import ModalCloseButton from './ModalCloseButton';
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
    requestAnimationFrame(() => {
      window.print();
    });
  }

  async function exportPdf() {
    if (!detail) return;
    setPdfLoading(true);
    try {
      const blob = await api.exportWorkerPdf(staffId, params);
      downloadBlob(blob, `scorecard-${formatStaffRegNo(detail.staff.reg_no)}.pdf`);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'PDF failed');
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 print:static print:overflow-visible print:p-0">
      <div
        className="absolute inset-0 bg-black/70 print:hidden"
        aria-hidden
        onClick={onClose}
      />
      <div
        id="scorecard-print-area"
        className="relative my-4 w-full max-w-5xl rounded-xl border border-border bg-card text-card-foreground shadow-lg print:my-0 print:max-w-none print:border-0 print:shadow-none"
      >
        <div className="relative flex items-center justify-between border-b border-border p-5 pr-14 print:border-slate-300">
          <h3 className="font-semibold text-lg print:text-black">Worker Scorecard</h3>
          <div className="flex gap-2 print:hidden">
            <button type="button" onClick={exportPdf} disabled={pdfLoading}
              className="px-3 py-1.5 text-sm border border-red-600/50 text-red-300 rounded-lg hover:bg-red-900/20">
              {pdfLoading ? '...' : 'PDF'}
            </button>
            <button
              type="button"
              onClick={printCard}
              className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm hover:bg-muted"
            >
              Print
            </button>
          </div>
          <ModalCloseButton onClick={onClose} className="absolute right-4 top-4 print:hidden" />
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
                {formatStaffRegNo(detail.staff.reg_no)} · {detail.staff.department} · {detail.from} to {detail.to}
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
              <h4 className="mb-2 text-sm font-medium text-foreground print:text-black">Daily Entries</h4>
              {detail.entries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No entries in this period.</p>
              ) : (
                <div className="-mx-5 overflow-x-auto px-5 print:overflow-visible print:mx-0 print:px-0">
                  <table className="w-full min-w-[52rem] border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border text-left text-muted-foreground">
                        <th className="whitespace-nowrap py-2 pr-4 font-semibold">Date</th>
                        <th className="whitespace-nowrap py-2 pr-4 font-semibold">Product</th>
                        <th className="whitespace-nowrap py-2 pr-4 font-semibold">Work station</th>
                        <th className="whitespace-nowrap py-2 pr-4 text-right font-semibold">Qty</th>
                        <th className="whitespace-nowrap py-2 pr-4 font-semibold">Grade</th>
                        <th className="whitespace-nowrap py-2 pr-4 font-semibold">Entered by</th>
                        <th className="whitespace-nowrap py-2 pr-4 font-semibold">Saved (Nepal)</th>
                        <th className="whitespace-nowrap py-2 pr-4 font-semibold">Updated (Nepal)</th>
                        <th className="whitespace-nowrap py-2 pl-2 text-right font-semibold print:hidden">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.entries.map((e) => (
                        <tr key={e.id} className="border-b border-border/60">
                          <td className="whitespace-nowrap py-2.5 pr-4">{e.entry_date}</td>
                          <td className="whitespace-nowrap py-2.5 pr-4 font-mono font-medium">{e.prod_code}</td>
                          <td className="max-w-[8rem] py-2.5 pr-4 text-muted-foreground">
                            <span className="line-clamp-2">{e.cost_center_name || e.cost_center_code}</span>
                          </td>
                          <td className="whitespace-nowrap py-2.5 pr-4 text-right tabular-nums">{e.quantity}</td>
                          <td className="whitespace-nowrap py-2.5 pr-4">
                            <GradeBadge grade={e.grade} />
                          </td>
                          <td className="whitespace-nowrap py-2.5 pr-4 text-muted-foreground">
                            {e.entered_by || '—'}
                          </td>
                          <td
                            className="whitespace-nowrap py-2.5 pr-4 text-primary"
                            title={e.created_at || undefined}
                          >
                            {formatNepalDateTime(e.created_at)}
                          </td>
                          <td className="py-2.5 pr-4 text-muted-foreground" title={e.updated_at || undefined}>
                            {e.updated_at ? (
                              <span className="block whitespace-nowrap">
                                <span className="block text-foreground">{e.updated_by || '—'}</span>
                                <span className="block text-primary">{formatNepalDateTime(e.updated_at)}</span>
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="whitespace-nowrap py-2.5 pl-2 text-right print:hidden">
                            <button
                              type="button"
                              onClick={() => openAudit(e.id)}
                              className="text-[11px] font-medium text-primary hover:underline"
                            >
                              History
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
    <div className="rounded-lg border border-border bg-muted/40 p-3 print:border-slate-200 print:bg-slate-50">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold leading-snug text-foreground">{value}</p>
    </div>
  );
}
