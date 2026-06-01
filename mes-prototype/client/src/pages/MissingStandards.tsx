import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import DateInput from '../components/DateInput';
import DepartmentBanner from '../components/DepartmentBanner';
import PageShell from '../components/PageShell';
import TableSkeleton from '../components/skeleton/TableSkeleton';

type Row = {
  prod_code: string;
  prod_name: string;
  activity_name: string;
  cost_center_code: string;
  cost_center_name: string;
  department: string;
  hits: number;
  last_seen: string;
};

export default function MissingStandards() {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.missingStandards({ date })
      .then((r) => setRows((r.rows || []) as Row[]))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [date]);

  return (
    <PageShell>
      <header className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold">Missing standards (today)</h2>
          <p className="text-slate-400 text-sm mt-1">
            Products/job types that could not be graded — prioritize setup.
          </p>
        </div>
        <div className="w-full sm:w-64 shrink-0">
          <DateInput value={date} onChange={setDate} />
        </div>
      </header>

      <DepartmentBanner />

      {loading ? (
        <TableSkeleton columns={7} rows={6} label="Loading missing standards" />
      ) : rows.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500">
          No missing-standard reports for this date.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-slate-400 text-left">
              <tr>
                <th className="p-3">Product</th>
                <th className="p-3">Job type</th>
                <th className="p-3">Work station</th>
                <th className="p-3">Department</th>
                <th className="p-3 text-right">Hits</th>
                <th className="p-3">Last seen</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.prod_code}-${r.activity_name}-${r.cost_center_code}-${r.department}-${i}`} className="border-t border-slate-800">
                  <td className="p-3">
                    <p className="font-mono text-amber-200/90">{r.prod_code}</p>
                    {r.prod_name && <p className="text-xs text-slate-500 truncate">{r.prod_name}</p>}
                  </td>
                  <td className="p-3">{r.activity_name || '—'}</td>
                  <td className="p-3">
                    <span className="font-mono text-xs">{r.cost_center_code || '—'}</span>
                    {r.cost_center_name && <span className="text-xs text-slate-500 ml-2">{r.cost_center_name}</span>}
                  </td>
                  <td className="p-3">{r.department || '—'}</td>
                  <td className="p-3 text-right font-semibold">{r.hits}</td>
                  <td className="p-3 text-xs text-slate-500 whitespace-nowrap">{r.last_seen}</td>
                  <td className="p-3 whitespace-nowrap">
                    <Link
                      to={`/standards?q=${encodeURIComponent(r.prod_code)}`}
                      className="text-xs text-amber-400 hover:underline"
                    >
                      Open grading rules →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}

