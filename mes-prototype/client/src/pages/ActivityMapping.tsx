import { useEffect, useState } from 'react';
import { api, type Activity, type ActivityMapping, type CostCenter } from '../api';

export default function ActivityMappingPage() {
  const [mappings, setMappings] = useState<ActivityMapping[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [activityId, setActivityId] = useState('');
  const [costCenterCode, setCostCenterCode] = useState('');
  const [error, setError] = useState('');

  async function load() {
    const [m, a, c] = await Promise.all([
      api.activityMappings(),
      api.activities(),
      api.costCenters(),
    ]);
    setMappings(m);
    setActivities(a);
    setCostCenters(c);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!activityId || !costCenterCode) {
      setError('Select job type and work station');
      return;
    }
    try {
      await api.addActivityMapping(Number(activityId), costCenterCode);
      setActivityId('');
      setCostCenterCode('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Remove this mapping?')) return;
    await api.deleteActivityMapping(id);
    load();
  }

  const byActivity = activities.map((act) => ({
    activity: act,
    centers: mappings.filter((m) => m.activity_id === act.id),
  }));

  return (
    <div className="p-8 max-w-6xl">
      <header className="mb-8">
        <h2 className="text-2xl font-bold">Job type ↔ work station</h2>
        <p className="text-slate-400 text-sm mt-1">
          Link job types to work stations used in grading rules
        </p>
      </header>

      <form onSubmit={handleAdd} className="flex flex-wrap gap-3 mb-8 p-4 bg-slate-900 border border-slate-800 rounded-xl">
        <select
          value={activityId}
          onChange={(e) => setActivityId(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm flex-1 min-w-[160px]"
        >
          <option value="">Select job type...</option>
          {activities.map((a) => (
            <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
          ))}
        </select>
        <select
          value={costCenterCode}
          onChange={(e) => setCostCenterCode(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px]"
        >
          <option value="">Select work station...</option>
          {costCenters.map((c) => (
            <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
          ))}
        </select>
        <button type="submit" className="px-4 py-2 rounded-lg bg-amber-500 text-slate-900 font-semibold text-sm">
          Add Mapping
        </button>
        {error && <p className="text-red-400 text-sm w-full">{error}</p>}
      </form>

      <div className="space-y-4">
        {byActivity.map(({ activity, centers }) => (
          <div key={activity.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h3 className="font-medium text-amber-200/90">
              {activity.code} — {activity.name}
            </h3>
            {centers.length === 0 ? (
              <p className="text-slate-500 text-sm mt-2">No work stations mapped</p>
            ) : (
              <ul className="mt-3 flex flex-wrap gap-2">
                {centers.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-1.5 text-sm"
                  >
                    <span className="font-mono text-xs text-slate-400">{m.cost_center_code}</span>
                    <span>{m.cost_center_name}</span>
                    <button
                      type="button"
                      onClick={() => handleDelete(m.id)}
                      className="text-red-400 hover:text-red-300 text-xs ml-1"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-500 mt-6">
        {mappings.length} total mappings · Admin can add/remove · Seeded from job type / work station name patterns
      </p>
    </div>
  );
}
