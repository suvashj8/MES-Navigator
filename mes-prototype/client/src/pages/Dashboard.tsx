import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Dashboard as DashboardData } from '../api';
import GradeBadge from '../components/GradeBadge';
import DateInput from '../components/DateInput';
import DepartmentBanner from '../components/DepartmentBanner';
import { useAuth } from '../hooks/useAuth';
import { loadOfflineQueue, offlineQueueKey, syncOfflineQueue } from '../offlineQueue';
import Toast from '../components/Toast';
import DashboardSkeleton from '../components/skeleton/DashboardSkeleton';
import PageShell from '../components/PageShell';
import { displayStaffRegNo } from '../utils/staffRegNo';

export default function Dashboard() {
  const { user, can } = useAuth();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [bsDisplay, setBsDisplay] = useState('');
  const [notGradedOffset, setNotGradedOffset] = useState(0);
  const notGradedLimit = 10;
  const [dashSearch, setDashSearch] = useState('');
  const [offlineCount, setOfflineCount] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const offlineKey = useMemo(() => offlineQueueKey(user?.username), [user?.username]);

  useEffect(() => {
    setOfflineCount(loadOfflineQueue(offlineKey).length);
  }, [offlineKey]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === offlineKey) setOfflineCount(loadOfflineQueue(offlineKey).length);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [offlineKey]);

  const entryPath = useMemo(() => {
    if (!user) return '/daily-entry';
    return user.role === 'operator' ? '/floor' : '/daily-entry';
  }, [user]);

  useEffect(() => {
    setLoading(true);
    api.dashboard({ date, notGradedOffset, notGradedLimit }).then(setData).catch(console.error).finally(() => setLoading(false));
    api.nepaliDate(date).then((r) => setBsDisplay(r.bs_display || '')).catch(() => setBsDisplay(''));
  }, [date, notGradedOffset]);

  // Prefetch common next steps (warms network/cache).
  useEffect(() => {
    api.activities().catch(() => {});
    api.departments().catch(() => {});
    api.staff().catch(() => {});
  }, []);

  const grades = ['C', 'B', 'A', 'AA'];
  const gradeMap = Object.fromEntries((data?.gradeDist || []).map((g) => [g.grade, g.count]));
  const maxTrend = Math.max(1, ...(data?.trend.days.map((d) => d.total) || [1]));

  return (
    <PageShell>
      {toastMessage && <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} durationMs={2400} />}
      <header className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold">Production Dashboard</h2>
          <p className="text-slate-400 text-sm mt-1">
            Daily worker performance overview
            {bsDisplay && (
              <span className="text-slate-500">
                {' '}· {date} (AD) · {bsDisplay} (BS)
              </span>
            )}
          </p>
          <div className="mt-4 flex items-center gap-2 w-full max-w-xl xl:max-w-2xl">
            <input
              value={dashSearch}
              onChange={(e) => setDashSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  window.dispatchEvent(new CustomEvent('mes:openPalette', { detail: { q: dashSearch } }));
                }
              }}
              placeholder="Search worker / reg # / product…"
              className="flex-1 h-10 rounded-xl bg-slate-800 border border-slate-700 px-3 text-sm text-slate-100 placeholder:text-slate-400"
            />
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('mes:openPalette', { detail: { q: dashSearch } }))}
              className="h-10 px-4 rounded-xl bg-amber-500 text-slate-950 font-semibold text-sm"
            >
              Search
            </button>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('mes:openPalette', { detail: { q: '' } }))}
              className="h-10 px-3 rounded-xl border border-slate-600 bg-white text-slate-800 text-sm hover:bg-slate-100"
              title="Open command palette"
            >
              Ctrl+K
            </button>
          </div>
          {offlineCount > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-amber-300">
                Pending sync: <strong>{offlineCount}</strong>
              </span>
              <button
                type="button"
                onClick={async () => {
                  const r = await syncOfflineQueue(offlineKey, { max: 50 });
                  setOfflineCount(r.remaining);
                  setToastMessage(r.synced > 0 ? `Synced ${r.synced} offline entries` : 'Nothing to sync');
                }}
                className="text-xs text-amber-300 underline hover:no-underline"
              >
                Sync now
              </button>
            </div>
          )}
        </div>
        <div className="w-full sm:w-64 shrink-0">
          <DateInput value={date} onChange={setDate} />
        </div>
      </header>

      <DepartmentBanner />

      {!loading && data && (data.productsWithoutRulesCount ?? 0) > 0 && (
        <div className="mes-notice-sky mb-6 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            <p className="font-semibold">
              {data.productsWithoutRulesCount} product{data.productsWithoutRulesCount === 1 ? '' : 's'} need a grading rule
            </p>
            <p className="mes-notice-muted text-xs mt-1">
              These exist in Product Master ({data.productMasterCount ?? '—'} total) but have no work-station rule yet. Daily
              entry cannot grade them until you add C/B/A/A+ thresholds.
            </p>
          </div>
          {can('standards:read') && (
            <Link
              to="/standards"
              className="shrink-0 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold"
            >
              Set up grading rules →
            </Link>
          )}
        </div>
      )}

      {!loading && data && (data.productsWithoutRulesCount ?? 0) === 0 && (data.productMasterCount ?? 0) > 0 && (
        <div className="mes-notice-emerald mb-6 rounded-xl px-4 py-2.5 text-sm">
          All {data.productMasterCount} Product Master item{data.productMasterCount === 1 ? '' : 's'} have at least one
          grading rule ({data.standardsCount} rule{data.standardsCount === 1 ? '' : 's'} total).
        </div>
      )}

      {loading ? (
        <DashboardSkeleton />
      ) : data ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            {[
              { label: 'Entries Today', value: data.todayEntries, color: 'text-amber-300' },
              { label: 'This Week (workers)', value: data.weekWorkersGraded, color: 'text-sky-300' },
              { label: 'This Week (entries)', value: data.weekEntries, color: 'text-violet-300' },
              { label: 'Active Staff', value: data.staffCount, color: 'text-emerald-300' },
              {
                label: 'Product Master',
                value: data.productMasterCount ?? 0,
                color: 'text-slate-200',
              },
              {
                label: 'Need grading rule',
                value: data.productsWithoutRulesCount ?? 0,
                color: (data.productsWithoutRulesCount ?? 0) > 0 ? 'text-sky-300' : 'text-emerald-300',
              },
            ].map((s) => (
              <div
                key={s.label}
                className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col min-h-[6.75rem]"
              >
                <p className="text-xs text-slate-400 uppercase tracking-wide leading-snug min-h-[2.5rem] flex items-end">
                  {s.label}
                </p>
                <p className={`text-3xl font-bold mt-2 tabular-nums leading-none ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">Last 7 Days — Grading Entries</h3>
              <Link to="/reports" className="text-xs text-amber-400 hover:underline">View scorecards →</Link>
            </div>
            <div className="flex items-end gap-2 h-32">
              {data.trend.days.map((d) => (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                  <span className="text-xs text-slate-500">{d.total || ''}</span>
                  <Link
                    to={`/reports?period=weekly&anchor=${encodeURIComponent(d.date)}`}
                    className="w-full"
                    title={`Open scorecards for week of ${d.date}`}
                  >
                    <div
                      className="w-full bg-amber-500/60 rounded-t min-h-[4px] transition-all hover:bg-amber-500/80"
                      style={{ height: `${Math.max(4, (d.total / maxTrend) * 100)}%` }}
                    />
                  </Link>
                  <span className="text-[10px] text-slate-500 truncate w-full text-center">
                    {d.date.slice(5)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <div className="grid md:grid-cols-2 gap-6">
            <section className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h3 className="font-semibold mb-4">Grade Distribution ({data.date})</h3>
              <div className="flex gap-4 flex-wrap">
                {grades.map((g) => (
                  <Link
                    key={g}
                    to={`/reports?period=weekly&anchor=${encodeURIComponent(date)}&grade=${encodeURIComponent(g)}`}
                    className="flex items-center gap-3 bg-slate-800/50 rounded-lg px-4 py-3 min-w-[120px] hover:bg-slate-800 transition-colors"
                    title={`Open scorecards filtered to grade ${g}`}
                  >
                    <GradeBadge grade={g} />
                    <span className="text-2xl font-bold">{gradeMap[g] || 0}</span>
                    <span className="text-xs text-slate-500 ml-auto">View →</span>
                  </Link>
                ))}
              </div>
              {data.todayEntries === 0 && (
                <p className="text-slate-500 text-sm mt-4">
                  No entries for this date — add the first one above.{' '}
                  <Link to="/daily-entry" className="text-amber-400 hover:underline">Add production entry</Link>
                </p>
              )}
            </section>

            <section className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h3 className="font-semibold mb-4">By Department</h3>
              {data.deptSummary.length === 0 ? (
                <p className="text-slate-500 text-sm">No department data yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-400 text-left border-b border-slate-800">
                      <th className="pb-2">Department</th>
                      <th className="pb-2">Grade</th>
                      <th className="pb-2 text-right">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.deptSummary.map((row, i) => (
                      <tr key={i} className="border-b border-slate-800/50">
                        <td className="py-2">{row.department}</td>
                        <td><GradeBadge grade={row.grade} /></td>
                        <td className="text-right font-medium">{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </div>

          <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 mt-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="min-w-0">
                <h3 className="font-semibold">Workers not graded today</h3>
                {typeof data.workersNotGradedTotal === 'number' && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    Showing {Math.min((data.workersNotGradedOffset || 0) + 1, data.workersNotGradedTotal)}–{Math.min((data.workersNotGradedOffset || 0) + (data.workersNotGradedLimit || notGradedLimit), data.workersNotGradedTotal)} of {data.workersNotGradedTotal}
                  </p>
                )}
              </div>
              <Link to="/floor" className="text-xs text-amber-400 hover:underline">Go to floor entry →</Link>
            </div>
            {(data.workersNotGradedToday?.length || 0) === 0 ? (
              <p className="text-slate-500 text-sm">All active workers have at least one entry today.</p>
            ) : (
              <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {data.workersNotGradedToday!.map((w) => (
                  <li key={w.id} className="bg-slate-800/40 border border-slate-800 rounded-lg px-3 py-2">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium truncate">{w.name}</p>
                      {can('daily-grading:write') && (
                        <Link
                          to={`${entryPath}?staff_id=${encodeURIComponent(String(w.id))}&date=${encodeURIComponent(date)}`}
                          className="text-xs text-amber-400 hover:underline shrink-0"
                          title="Open entry with this worker selected"
                        >
                          Grade now →
                        </Link>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 truncate">
                      <span className="font-mono">{displayStaffRegNo(w)}</span>
                      <span className="mx-2">·</span>
                      {w.department}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {typeof data.workersNotGradedTotal === 'number' && data.workersNotGradedTotal > notGradedLimit && (
              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setNotGradedOffset((o) => Math.max(0, o - notGradedLimit))}
                  disabled={(data.workersNotGradedOffset || 0) <= 0}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                >
                  ← Previous
                </button>
                <button
                  type="button"
                  onClick={() => setNotGradedOffset((o) => o + notGradedLimit)}
                  disabled={(data.workersNotGradedOffset || 0) + notGradedLimit >= data.workersNotGradedTotal}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            )}
          </section>
        </>
      ) : null}
    </PageShell>
  );
}
