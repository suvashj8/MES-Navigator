import { useEffect, useMemo, useRef, useState } from 'react';
import { api, downloadBlob, type Scorecard, type ScorecardParams, type ScorecardReport, type Staff } from '../api';
import GradeBadge from '../components/GradeBadge';
import WorkerDetailModal from '../components/WorkerDetailModal';
import DepartmentBanner from '../components/DepartmentBanner';
import { useLocation, useNavigate } from 'react-router-dom';
import Toast from '../components/Toast';

export default function Reports() {
  const location = useLocation();
  const navigate = useNavigate();
  const didInitFromUrl = useRef(false);
  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'custom'>('weekly');
  const [anchor, setAnchor] = useState(new Date().toISOString().slice(0, 10));
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [department, setDepartment] = useState('');
  const [staffId, setStaffId] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [departments, setDepartments] = useState<string[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [report, setReport] = useState<ScorecardReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [detailStaffId, setDetailStaffId] = useState<number | null>(null);
  const [deptLocked, setDeptLocked] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (didInitFromUrl.current) return;
    didInitFromUrl.current = true;
    const sp = new URLSearchParams(location.search);
    const p = sp.get('period') as any;
    const a = sp.get('anchor');
    const g = sp.get('grade');
    if (p === 'weekly' || p === 'monthly' || p === 'custom') setPeriod(p);
    if (a) setAnchor(a);
    if (g) setGradeFilter(g);
  }, [location.search]);

  // Keep URL in sync (shareable)
  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    sp.set('period', period);
    if (period !== 'custom') sp.set('anchor', anchor);
    else sp.delete('anchor');
    if (gradeFilter) sp.set('grade', gradeFilter);
    else sp.delete('grade');
    navigate({ search: `?${sp.toString()}` }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, anchor, gradeFilter]);

  useEffect(() => {
    api.departments().then(setDepartments);
    api.scope().then((s) => {
      if (s.locked && s.department) {
        setDepartment(s.department);
        setDeptLocked(true);
      }
    });
  }, []);

  useEffect(() => {
    api.staff(department ? { department } : undefined).then(setStaffList);
  }, [department]);

  useEffect(() => {
    loadReport();
  }, [period, anchor, dateFrom, dateTo, department, staffId]);

  function reportParams(): ScorecardParams {
    const base: ScorecardParams = {
      period,
      department: department || undefined,
      staff_id: staffId ? Number(staffId) : undefined,
    };
    if (period === 'custom') {
      return { ...base, from: dateFrom, to: dateTo };
    }
    return { ...base, anchor };
  }

  async function loadReport() {
    if (period === 'custom' && (!dateFrom || !dateTo)) return;
    setLoading(true);
    try {
      const data = await api.scorecards(reportParams());
      setReport(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function printReport() {
    window.print();
  }

  async function exportCsv() {
    setExporting(true);
    try {
      setToastMessage(`Preparing ${fileCsv}…`);
      const blob = await api.exportScorecardsCsv(reportParams());
      downloadBlob(blob, fileCsv);
      setToastMessage(`Downloaded ${fileCsv}`);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  async function exportPdf() {
    setExportingPdf(true);
    try {
      setToastMessage(`Preparing ${filePdf}…`);
      const blob = await api.exportScorecardsPdf(reportParams());
      downloadBlob(blob, filePdf);
      setToastMessage(`Downloaded ${filePdf}`);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'PDF export failed');
    } finally {
      setExportingPdf(false);
    }
  }

  const fileCsv = useMemo(() => `scorecards-${report?.from || dateFrom || anchor}-${report?.to || dateTo || anchor}.csv`, [report, dateFrom, dateTo, anchor]);
  const filePdf = useMemo(() => `scorecards-${report?.from || anchor}-${report?.to || anchor}.pdf`, [report, anchor]);

  const shownScorecards = useMemo(() => {
    if (!report) return [];
    if (!gradeFilter) return report.scorecards;
    return report.scorecards.filter((c) => (c.grade_distribution.find((g) => g.grade === gradeFilter)?.count || 0) > 0);
  }, [report, gradeFilter]);

  return (
    <div className="p-4 md:p-8 max-w-6xl print:p-4">
      {toastMessage && <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} durationMs={2400} />}
      <header className="flex flex-wrap items-end justify-between gap-4 mb-8 print:mb-4">
        <div>
          <h2 className="text-2xl font-bold">Worker Scorecards</h2>
          <p className="text-slate-400 text-sm mt-1">Weekly, monthly, or custom date range</p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <button type="button" onClick={exportCsv} disabled={loading || exporting}
            className="px-4 py-2 rounded-lg border border-emerald-700/50 text-emerald-300 text-sm disabled:opacity-40">
            {exporting ? '...' : 'Download Excel (CSV)'}
          </button>
          <button type="button" onClick={exportPdf} disabled={loading || exportingPdf}
            className="px-4 py-2 rounded-lg border border-red-700/50 text-red-300 text-sm disabled:opacity-40">
            {exportingPdf ? '...' : 'Download PDF'}
          </button>
          <button type="button" onClick={printReport}
            className="px-4 py-2 rounded-lg border border-slate-700 text-sm hover:bg-slate-800">Print</button>
        </div>
      </header>
      {!loading && report && (
        <div className="mb-3 text-xs text-slate-500 print:hidden">
          {fileCsv} · {filePdf}
        </div>
      )}

      <DepartmentBanner />

      <div className="flex flex-wrap gap-3 mb-6 print:hidden">
        <div className="flex rounded-lg overflow-hidden border border-slate-700">
          {(['weekly', 'monthly', 'custom'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setPeriod(p);
                if (p === 'custom' && !dateFrom) {
                  const end = anchor || new Date().toISOString().slice(0, 10);
                  const start = new Date(end + 'T12:00:00');
                  start.setDate(start.getDate() - 6);
                  setDateFrom(start.toISOString().slice(0, 10));
                  setDateTo(end);
                }
              }}
              className={`px-4 py-2 text-sm capitalize ${period === p ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-400'}`}
            >
              {p === 'custom' ? 'Custom' : p}
            </button>
          ))}
        </div>
        {period === 'custom' ? (
          <>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
            <span className="self-center text-slate-500">to</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
          </>
        ) : (
          <input type="date" value={anchor} onChange={(e) => setAnchor(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm"
            title={period === 'weekly' ? 'Any day in the week' : 'Any day in the month'} />
        )}
        <select value={department} onChange={(e) => setDepartment(e.target.value)}
          disabled={deptLocked}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm disabled:opacity-60">
          <option value="">All Departments</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={staffId} onChange={(e) => setStaffId(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm min-w-[180px]">
          <option value="">All Workers</option>
          {staffList.map((s) => (
            <option key={s.id} value={s.id}>{s.reg_no} — {s.name}</option>
          ))}
        </select>
      </div>

      {period === 'custom' && (!dateFrom || !dateTo) && (
        <p className="text-amber-400/90 text-sm mb-4">Select both From and To dates for custom range.</p>
      )}

      {report && (
        <div className="mb-6 text-sm text-slate-400">
          <span className="text-slate-200 font-medium">{report.label}</span>
          <span className="mx-2">·</span>{report.from} to {report.to}
          <span className="mx-2">·</span>{shownScorecards.length} worker(s)
          {gradeFilter && (
            <>
              <span className="mx-2">·</span>
              <span className="text-amber-300 font-medium">Grade filter: {gradeFilter}</span>
              <button
                type="button"
                onClick={() => {
                  setGradeFilter('');
                  const sp = new URLSearchParams(location.search);
                  sp.delete('grade');
                  navigate({ search: sp.toString() ? `?${sp.toString()}` : '' }, { replace: true });
                }}
                className="ml-2 text-xs text-slate-400 hover:text-slate-200 underline"
              >
                Clear
              </button>
            </>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-slate-400">Loading scorecards...</p>
      ) : !report?.scorecards.length ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500">
          No grading entries in this period.
        </div>
      ) : gradeFilter && shownScorecards.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500">
          No workers match grade <span className="text-slate-200 font-medium">{gradeFilter}</span> in this period.
        </div>
      ) : (
        <div className="space-y-4">
          {shownScorecards.map((card) => (
            <ScorecardCard
              key={card.staff_id}
              card={card}
              expanded={expanded === card.staff_id}
              onToggle={() => setExpanded(expanded === card.staff_id ? null : card.staff_id)}
              onViewDetail={() => setDetailStaffId(card.staff_id)}
            />
          ))}
        </div>
      )}

      {detailStaffId != null && (
        <WorkerDetailModal
          staffId={detailStaffId}
          params={reportParams()}
          onClose={() => setDetailStaffId(null)}
        />
      )}
    </div>
  );
}

function ScorecardCard({
  card, expanded, onToggle, onViewDetail,
}: {
  card: Scorecard;
  expanded: boolean;
  onToggle: () => void;
  onViewDetail: () => void;
}) {
  const ratingColor: Record<string, string> = {
    Excellent: 'text-amber-300', Good: 'text-emerald-400',
    Average: 'text-orange-400', 'Needs Improvement': 'text-red-400',
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden print:break-inside-avoid">
      <div className="w-full p-5 flex flex-wrap items-center gap-4">
        <button type="button" onClick={onToggle} className="flex-1 min-w-[200px] text-left hover:opacity-90">
          <p className="font-semibold text-lg">{card.staff_name}</p>
          <p className="text-sm text-slate-400">Reg #{card.reg_no} · {card.department}</p>
        </button>
        <div className="text-center">
          <p className="text-xs text-slate-500">Avg Score</p>
          <p className="text-2xl font-bold text-amber-300">{card.avg_score.toFixed(2)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-slate-500">Rating</p>
          <p className={`font-semibold ${ratingColor[card.rating] || ''}`}>{card.rating}</p>
        </div>
        <div className="flex gap-2">
          {card.grade_distribution.map((g) => g.count > 0 ? (
            <div key={g.grade} className="text-center">
              <GradeBadge grade={g.grade} />
              <p className="text-xs mt-1 text-slate-400">{g.count} ({g.percent}%)</p>
            </div>
          ) : null)}
        </div>
        <button type="button" onClick={onViewDetail}
          className="px-3 py-1.5 text-xs rounded-lg border border-amber-500/40 text-amber-300 hover:bg-amber-500/10 print:hidden">
          View / Print
        </button>
      </div>
      {expanded && (
        <div className="px-5 pb-5 border-t border-slate-800 grid sm:grid-cols-4 gap-4 text-sm">
          <Stat label="Entries" value={card.total_entries} />
          <Stat label="Days Worked" value={card.days_worked} />
          <Stat label="Total Qty" value={card.total_quantity} />
          <Stat label="Total W Min" value={card.total_w_min} />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-slate-800/50 rounded-lg p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
