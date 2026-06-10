import { useEffect, useState } from 'react';
import { api, type Activity, type ActivityMapping, type CostCenter } from '../api';
import ModalCloseButton from '../components/ModalCloseButton';
import PageShell from '../components/PageShell';
import { useConfirm } from '../hooks/useConfirm';
import {
  blockNegativeNumberKey,
  sanitizeNonNegativeIntegerInput,
} from '../utils/numericInput';

export default function ActivityMappingPage() {
  const confirm = useConfirm();
  const [mappings, setMappings] = useState<ActivityMapping[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [activityId, setActivityId] = useState('');
  const [costCenterCode, setCostCenterCode] = useState('');
  const [error, setError] = useState('');

  const [showAddJob, setShowAddJob] = useState(false);
  const [jobCode, setJobCode] = useState('');
  const [jobName, setJobName] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [jobError, setJobError] = useState('');
  const [jobSaving, setJobSaving] = useState(false);

  const [showAddWs, setShowAddWs] = useState(false);
  const [wsCode, setWsCode] = useState('');
  const [wsName, setWsName] = useState('');
  const [wsDescription, setWsDescription] = useState('');
  const [wsError, setWsError] = useState('');
  const [wsSaving, setWsSaving] = useState(false);

  async function loadLists() {
    const [a, c] = await Promise.all([api.activities(), api.costCenters()]);
    setActivities(a);
    setCostCenters(c);
    return { a, c };
  }

  async function load() {
    const [m] = await Promise.all([api.activityMappings(), loadLists()]);
    setMappings(m);
  }

  useEffect(() => {
    void load();
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
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function handleAddJob(e: React.FormEvent) {
    e.preventDefault();
    setJobError('');
    setJobSaving(true);
    try {
      const code = Number(jobCode);
      if (!Number.isInteger(code) || code <= 0) {
        setJobError('Job ID must be a positive whole number');
        return;
      }
      const created = await api.createActivity({
        code,
        name: jobName.trim(),
        description: jobDescription.trim(),
      });
      await loadLists();
      setActivityId(String(created.id));
      setShowAddJob(false);
      setJobCode('');
      setJobName('');
      setJobDescription('');
    } catch (err) {
      setJobError(err instanceof Error ? err.message : 'Failed to add job');
    } finally {
      setJobSaving(false);
    }
  }

  async function handleAddWorkstation(e: React.FormEvent) {
    e.preventDefault();
    setWsError('');
    setWsSaving(true);
    try {
      const created = await api.createCostCenter({
        code: wsCode.trim(),
        name: wsName.trim(),
        description: wsDescription.trim(),
      });
      await loadLists();
      setCostCenterCode(created.code);
      setShowAddWs(false);
      setWsCode('');
      setWsName('');
      setWsDescription('');
    } catch (err) {
      setWsError(err instanceof Error ? err.message : 'Failed to add work station');
    } finally {
      setWsSaving(false);
    }
  }

  async function handleDelete(id: number) {
    const ok = await confirm({
      title: 'Remove mapping',
      message: 'Remove this mapping?',
      confirmLabel: 'Remove',
      variant: 'danger',
    });
    if (!ok) return;
    await api.deleteActivityMapping(id);
    await load();
  }

  const byActivity = activities.map((act) => ({
    activity: act,
    centers: mappings.filter((m) => m.activity_id === act.id),
  }));

  return (
    <PageShell>
      <header className="mb-8 flex flex-wrap justify-between items-end gap-4">
        <div>
          <h2 className="text-2xl font-bold">Job type ↔ work station</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Link job types to work stations used in grading rules
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setJobError('');
              setShowAddJob(true);
            }}
            className="px-4 py-2 rounded-lg bg-amber-500 text-slate-900 font-semibold text-sm"
          >
            + Add Job
          </button>
          <button
            type="button"
            onClick={() => {
              setWsError('');
              setShowAddWs(true);
            }}
            className="px-4 py-2 rounded-lg border border-primary/40 bg-background text-primary font-semibold text-sm hover:bg-accent"
          >
            + Add Workstation
          </button>
        </div>
      </header>

      <form
        onSubmit={handleAdd}
        className="flex flex-wrap gap-3 mb-8 p-4 bg-slate-900 border border-slate-800 rounded-xl"
      >
        <select
          value={activityId}
          onChange={(e) => setActivityId(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm flex-1 min-w-[160px]"
        >
          <option value="">Select job type...</option>
          {activities.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code} — {a.name}
            </option>
          ))}
        </select>
        <select
          value={costCenterCode}
          onChange={(e) => setCostCenterCode(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px]"
        >
          <option value="">Select work station...</option>
          {costCenters.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} — {c.name}
            </option>
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
            {activity.description ? (
              <p className="text-xs text-muted-foreground mt-1">{activity.description}</p>
            ) : null}
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
        {mappings.length} total mappings · Admin can add jobs, work stations, and mappings
      </p>

      {showAddJob && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleAddJob}
            className="relative bg-slate-900 border border-slate-700 rounded-xl p-6 pt-12 w-full max-w-md space-y-3"
          >
            <ModalCloseButton onClick={() => setShowAddJob(false)} className="absolute right-4 top-4 z-10" />
            <h3 className="font-semibold pr-10">Add Job</h3>
            <div>
              <label className="text-xs text-slate-400">Job ID *</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={jobCode}
                onChange={(e) => setJobCode(sanitizeNonNegativeIntegerInput(e.target.value))}
                onKeyDown={blockNegativeNumberKey}
                placeholder="e.g. 25"
                required
                className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 font-mono text-sm"
              />
              <p className="text-[11px] text-muted-foreground mt-1">Positive whole number (unique)</p>
            </div>
            <div>
              <label className="text-xs text-slate-400">Job name *</label>
              <input
                type="text"
                value={jobName}
                onChange={(e) => setJobName(e.target.value)}
                placeholder="e.g. Beading"
                maxLength={120}
                required
                className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Description</label>
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Optional notes"
                maxLength={500}
                rows={3}
                className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm resize-y"
              />
            </div>
            {jobError && <p className="text-red-400 text-sm">{jobError}</p>}
            <button
              type="submit"
              disabled={jobSaving}
              className="w-full py-2 rounded-lg bg-amber-500 text-slate-900 font-semibold disabled:opacity-50"
            >
              {jobSaving ? 'Saving…' : 'Save job'}
            </button>
          </form>
        </div>
      )}

      {showAddWs && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleAddWorkstation}
            className="relative bg-slate-900 border border-slate-700 rounded-xl p-6 pt-12 w-full max-w-md space-y-3"
          >
            <ModalCloseButton onClick={() => setShowAddWs(false)} className="absolute right-4 top-4 z-10" />
            <h3 className="font-semibold pr-10">Add Workstation</h3>
            <div>
              <label className="text-xs text-slate-400">Work station ID *</label>
              <input
                type="text"
                value={wsCode}
                onChange={(e) => setWsCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
                placeholder="e.g. BD001"
                maxLength={20}
                required
                className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 font-mono text-sm"
              />
              <p className="text-[11px] text-muted-foreground mt-1">Letters, numbers, hyphen, underscore</p>
            </div>
            <div>
              <label className="text-xs text-slate-400">Work station name *</label>
              <input
                type="text"
                value={wsName}
                onChange={(e) => setWsName(e.target.value)}
                placeholder="e.g. BEADING"
                maxLength={120}
                required
                className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Description</label>
              <textarea
                value={wsDescription}
                onChange={(e) => setWsDescription(e.target.value)}
                placeholder="Optional notes"
                maxLength={500}
                rows={3}
                className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm resize-y"
              />
            </div>
            {wsError && <p className="text-red-400 text-sm">{wsError}</p>}
            <button
              type="submit"
              disabled={wsSaving}
              className="w-full py-2 rounded-lg bg-amber-500 text-slate-900 font-semibold disabled:opacity-50"
            >
              {wsSaving ? 'Saving…' : 'Save work station'}
            </button>
          </form>
        </div>
      )}
    </PageShell>
  );
}
