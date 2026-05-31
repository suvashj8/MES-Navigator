import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api, type Activity, type DailyEntry, type GradePreviewResult, type GradingStandard, type Staff, type StandardProduct } from '../api';
import { useAuth } from '../context/AuthContext';
import GradeBadge from '../components/GradeBadge';
import DateInput from '../components/DateInput';
import FormField from '../components/FormField';
import Toast from '../components/Toast';
import DepartmentBanner from '../components/DepartmentBanner';
import { labels } from '../labels';
import Spinner from '../components/Spinner';
import { loadOfflineQueue, offlineQueueKey, saveOfflineQueue, syncOfflineQueue as syncQueue } from '../offlineQueue';
import {
  blockNegativeNumberKey,
  parseNonNegativeNumber,
  sanitizeNonNegativeIntegerInput,
} from '../utils/numericInput';

export default function DailyEntryPage({ floorMode = false }: { floorMode?: boolean }) {
  const { can, user } = useAuth();
  const location = useLocation();
  const canDelete = can('daily-grading:delete');
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [costCenters, setCostCenters] = useState<{ code: string; name: string }[]>([]);
  const [products, setProducts] = useState<StandardProduct[]>([]);
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [department, setDepartment] = useState('');
  const [departments, setDepartments] = useState<string[]>([]);

  const [staffId, setStaffId] = useState('');
  const [activityId, setActivityId] = useState('');
  const [prodCode, setProdCode] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [costCenter, setCostCenter] = useState('');
  const [quantity, setQuantity] = useState('');
  const [remarks, setRemarks] = useState('');
  const [standard, setStandard] = useState<GradingStandard | null>(null);
  const [preview, setPreview] = useState<GradePreviewResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [missingStandard, setMissingStandard] = useState(false);
  const [showProductList, setShowProductList] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [undoDelete, setUndoDelete] = useState<DailyEntry | null>(null);
  const [highlightEntryId, setHighlightEntryId] = useState<number | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [deptLocked, setDeptLocked] = useState(false);
  const entriesSectionRef = useRef<HTMLDivElement>(null);
  const saveSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const workerPickerRef = useRef<HTMLDivElement>(null);
  const [workerOpen, setWorkerOpen] = useState(false);
  const [workerQuery, setWorkerQuery] = useState('');
  const didPrefillRef = useRef(false);
  const sp = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const prefillStaffId = sp.get('staff_id') || '';
  const prefillDate = sp.get('date') || '';
  const [prefillFlash, setPrefillFlash] = useState(false);
  const quantityInputRef = useRef<HTMLInputElement>(null);
  const [recentWorkerIds, setRecentWorkerIds] = useState<string[]>([]);
  const recentKey = useMemo(() => `mes_recent_workers_${user?.username || 'anon'}`, [user?.username]);
  const [beepOnSave, setBeepOnSave] = useState(false);
  const [entriesView, setEntriesView] = useState<'list' | 'table'>(() => (floorMode ? 'list' : 'table'));
  const [showNepaliSubtitles, setShowNepaliSubtitles] = useState(() => {
    const v = localStorage.getItem('mes_show_nepali_subtitles');
    return v == null ? true : v === '1';
  });

  useEffect(() => {
    localStorage.setItem('mes_show_nepali_subtitles', showNepaliSubtitles ? '1' : '0');
  }, [showNepaliSubtitles]);

  const showNepali = floorMode || showNepaliSubtitles;

  const offlineKey = useMemo(() => offlineQueueKey(user?.username), [user?.username]);
  const [offlineCount, setOfflineCount] = useState(0);

  function updateOfflineCount() {
    setOfflineCount(loadOfflineQueue(offlineKey).length);
  }

  async function syncOfflineQueue() {
    if (!navigator.onLine) return;
    const { synced, remaining } = await syncQueue(offlineKey, { max: 50 });
    setOfflineCount(remaining);
    if (synced > 0) {
      setToastMessage(remaining === 0 ? 'Synced offline entries' : `Synced ${synced} offline entries`);
      const list = await refreshEntries();
      setEntries(list);
    }
  }

  const refreshEntries = useCallback(() => {
    return api.dailyGrading({ date, department: department || undefined });
  }, [date, department]);

  useEffect(() => {
    api.departments().then(setDepartments);
    api.activities().then(setActivities);
    api.scope().then((s) => {
      if (s.locked && s.department) {
        setDepartment(s.department);
        setDeptLocked(true);
      }
    });
  }, []);

  useEffect(() => {
    if (!prefillDate) return;
    // If the entry page is opened from the dashboard list, keep the same date.
    setDate(prefillDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillDate]);

  useEffect(() => {
    api.staff(department ? { department } : undefined).then(setStaffList);
  }, [department]);

  useEffect(() => {
    // Load recent worker picks (per user) + beep setting.
    try {
      const stored = localStorage.getItem(recentKey);
      const arr = stored ? (JSON.parse(stored) as string[]) : [];
      if (Array.isArray(arr)) setRecentWorkerIds(arr.filter(Boolean).slice(0, 6));
    } catch {
      /* ignore */
    }
    setBeepOnSave(localStorage.getItem('mes_beep_on_save') === '1');
    updateOfflineCount();
  }, [recentKey]);

  useEffect(() => {
    const onOnline = () => { syncOfflineQueue().catch(() => {}); };
    window.addEventListener('online', onOnline);
    // Try once on mount too.
    syncOfflineQueue().catch(() => {});
    return () => window.removeEventListener('online', onOnline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offlineKey]);

  useEffect(() => {
    try {
      localStorage.setItem(recentKey, JSON.stringify(recentWorkerIds.slice(0, 6)));
    } catch {
      /* ignore */
    }
  }, [recentKey, recentWorkerIds]);

  function addRecentWorker(id: string) {
    if (!id) return;
    setRecentWorkerIds((prev) => [id, ...prev.filter((x) => x !== id)].slice(0, 6));
  }

  useEffect(() => {
    if (didPrefillRef.current) return;
    if (!prefillStaffId) return;
    if (staffList.length === 0) return;
    if (!staffList.some((s) => String(s.id) === String(prefillStaffId))) return;
    didPrefillRef.current = true;
    setStaffId(String(prefillStaffId));
    addRecentWorker(String(prefillStaffId));
    setWorkerOpen(false);
    setWorkerQuery('');
    setPrefillFlash(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const t = setTimeout(() => setPrefillFlash(false), 2500);
    return () => clearTimeout(t);
  }, [prefillStaffId, staffList]);

  useEffect(() => {
    if (!staffId) return;
    addRecentWorker(staffId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffId]);

  useEffect(() => {
    refreshEntries().then(setEntries).catch(console.error);
  }, [refreshEntries]);

  useEffect(() => {
    if (!highlightEntryId) return;
    const row = document.getElementById(`entry-row-${highlightEntryId}`);
    if (!row) return;
    entriesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    const scrollRow = () => row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    requestAnimationFrame(scrollRow);
    const t = setTimeout(() => setHighlightEntryId(null), 3500);
    return () => clearTimeout(t);
  }, [highlightEntryId, entries]);

  useEffect(() => () => {
    if (saveSuccessTimerRef.current) clearTimeout(saveSuccessTimerRef.current);
  }, []);

  useEffect(() => {
    api.costCenters(activityId ? Number(activityId) : undefined).then((ccs) => {
      setCostCenters(ccs);
      if (costCenter && !ccs.some((c) => c.code === costCenter)) setCostCenter('');
    });
  }, [activityId]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (productSearch.length >= 1 || costCenter) {
        api.standardProducts({
          q: productSearch.length >= 1 ? productSearch : undefined,
          cost_center_code: costCenter || undefined,
        }).then(setProducts);
      } else {
        setProducts([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [productSearch, costCenter]);

  useEffect(() => {
    if (!prodCode || !costCenter) {
      setStandard(null);
      setPreview(null);
      setMissingStandard(false);
      return;
    }
    api.lookupStandard(prodCode, costCenter, date)
      .then((s) => { setStandard(s); setError(''); setMissingStandard(false); })
      .catch(() => { setStandard(null); setMissingStandard(true); });
  }, [prodCode, costCenter, date]);

  useEffect(() => {
    if (!missingStandard) return;
    if (!prodCode) return;
    if (!costCenter) return;
    // Fire-and-forget: log missing standard so supervisors see it.
    api.logMissingStandard({
      entry_date: date,
      department: department || undefined,
      staff_id: staffId ? Number(staffId) : undefined,
      staff_name: selectedWorker?.name,
      activity_id: activityId ? Number(activityId) : undefined,
      activity_name: selectedJobType?.name,
      cost_center_code: costCenter,
      cost_center_name: costCenters.find((c) => c.code === costCenter)?.name,
      prod_code: prodCode,
      prod_name: productSearch.includes('—') ? productSearch.split('—').slice(1).join('—').trim() : undefined,
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missingStandard, prodCode, costCenter]);

  useEffect(() => {
    const qty = parseNonNegativeNumber(quantity, NaN);
    if (!standard || !Number.isFinite(qty) || qty < 0) { setPreview(null); return; }
    api.previewGrade({ prod_code: prodCode, cost_center_code: costCenter, quantity: qty, entry_date: date })
      .then(setPreview).catch(() => setPreview(null));
  }, [standard, quantity, prodCode, costCenter, date]);

  function selectProduct(p: StandardProduct) {
    setProdCode(p.prod_code);
    setProductSearch(`${p.prod_code} — ${p.prod_name}`);
    setShowProductList(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!staffId || !prodCode || !costCenter || quantity.trim() === '' || !preview) {
      setError('Fill all required fields');
      return;
    }

    const duplicate = entries.find(
      (en) =>
        en.entry_date === date &&
        en.staff_id === Number(staffId) &&
        en.prod_code === prodCode &&
        en.cost_center_code === costCenter
    );
    if (duplicate) {
      const ok = confirm('This worker already has an entry for this product/work station today. Overwrite it?');
      if (!ok) return;
    }
    const grade = preview.grade;
    const worker = staffList.find((s) => s.id === Number(staffId));
    setSaving(true);
    try {
      const saved = await api.saveDailyGrading({
        entry_date: date,
        staff_id: Number(staffId),
        prod_code: prodCode,
        cost_center_code: costCenter,
        quantity: parseNonNegativeNumber(quantity),
        remarks,
      });

      setQuantity('');
      setRemarks('');
      setPreview(null);

      // Floor speed: put cursor back in Quantity for the next entry.
      requestAnimationFrame(() => {
        if (!quantityInputRef.current) return;
        if ((quantityInputRef.current as any).disabled) return;
        quantityInputRef.current.focus();
        quantityInputRef.current.select?.();
      });

      if (beepOnSave) {
        try {
          const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext);
          if (AudioCtx) {
            const ctx = new AudioCtx();
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = 'sine';
            o.frequency.value = 880;
            g.gain.value = 0.05;
            o.connect(g);
            g.connect(ctx.destination);
            o.start();
            o.stop(ctx.currentTime + 0.08);
            setTimeout(() => ctx.close().catch(() => {}), 120);
          }
        } catch {
          /* ignore */
        }
      }

      const name = worker?.name ?? 'Worker';
      const reg = worker?.reg_no ?? saved.reg_no ?? '—';
      setToastMessage(`Saved — Grade ${grade} for ${name} (Reg ${reg})`);
      setSaveSuccess(true);
      if (saveSuccessTimerRef.current) clearTimeout(saveSuccessTimerRef.current);
      saveSuccessTimerRef.current = setTimeout(() => setSaveSuccess(false), 2800);

      const list = await refreshEntries();
      setEntries(list);
      setHighlightEntryId(saved.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      const looksOffline =
        !navigator.onLine ||
        /failed to fetch|networkerror|load failed/i.test(msg);
      if (looksOffline) {
        const q = loadOfflineQueue(offlineKey);
        const payload = {
          entry_date: date,
          staff_id: Number(staffId),
          prod_code: prodCode,
          cost_center_code: costCenter,
          quantity: parseNonNegativeNumber(quantity),
          remarks,
        };
        // De-dupe exact same key.
        const key = `${payload.entry_date}|${payload.staff_id}|${payload.prod_code}|${payload.cost_center_code}`;
        const deduped = q.filter((it) => `${it.entry_date}|${it.staff_id}|${it.prod_code}|${it.cost_center_code}` !== key);
        deduped.unshift(payload);
        saveOfflineQueue(offlineKey, deduped.slice(0, 50));
        updateOfflineCount();
        setToastMessage('Saved offline — will sync when online');
        setError('');
      } else {
        setError(msg);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this entry?')) return;
    const deleted = entries.find((e) => e.id === id);
    await api.deleteDailyGrading(id);
    const list = await refreshEntries();
    setEntries(list);
    if (deleted) {
      setToastMessage(`Entry deleted — ${deleted.staff_name || 'Worker'} (${deleted.prod_code})`);
      // Offer undo via toast action (re-post the same entry).
      // (Toast action handled via separate state below.)
      setUndoDelete(deleted);
    } else {
      setToastMessage('Entry deleted');
    }
  }

  function entryRowClass(entryId: number) {
    const highlighted = entryId === highlightEntryId;
    return highlighted
      ? 'ring-2 ring-emerald-500/50 bg-emerald-900/25 animate-[entry-flash_1.4s_ease-out]'
      : '';
  }

  const entriesSorted = floorMode
    ? [...entries].sort((a, b) => (b.id || 0) - (a.id || 0))
    : entries;
  const last3 = floorMode ? entriesSorted.slice(0, 3) : [];

  async function exportDay() {
    setExporting(true);
    try {
      setToastMessage(`Preparing daily-grading-${date}.csv…`);
      const blob = await api.exportDailyGradingCsv(date, department || undefined);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `daily-grading-${date}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setToastMessage(`Downloaded daily-grading-${date}.csv`);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  const controlBase = floorMode
    ? 'w-full h-12 rounded-xl bg-slate-800 border border-slate-700 px-3 text-base'
    : 'w-full h-10 rounded-lg bg-slate-800 border border-slate-700 px-3 text-sm';

  function controlCls(disabled = false) {
    return `${controlBase}${disabled ? ' opacity-50 cursor-not-allowed' : ''}`;
  }

  type WorkflowStep = 'worker' | 'activity' | 'costCenter' | 'product' | 'quantity' | 'ready';

  function nextWorkflowStep(): WorkflowStep {
    if (!staffId) return 'worker';
    if (!activityId) return 'activity';
    if (!costCenter) return 'costCenter';
    if (!prodCode) return 'product';
    if (!quantity) return 'quantity';
    return 'ready';
  }

  const nextStep = nextWorkflowStep();
  const costCenterEnabled = Boolean(activityId);
  const productEnabled = Boolean(costCenter);
  const quantityEnabled = Boolean(prodCode);
  const selectedWorker = staffId ? staffList.find((s) => s.id === Number(staffId)) : undefined;
  const selectedJobType = activityId ? activities.find((a) => a.id === Number(activityId)) : undefined;

  const gradedWorkerIds = useMemo(() => new Set(entries.map((e) => e.staff_id)), [entries]);
  const ungradedWorkers = useMemo(
    () => staffList.filter((s) => !gradedWorkerIds.has(s.id)),
    [staffList, gradedWorkerIds]
  );

  function pickNextWorker() {
    if (ungradedWorkers.length === 0) return;
    const cur = Number(staffId || 0);
    const idx = ungradedWorkers.findIndex((s) => s.id === cur);
    const next = idx >= 0 ? ungradedWorkers[(idx + 1) % ungradedWorkers.length] : ungradedWorkers[0];
    setStaffId(String(next.id));
    setPrefillFlash(true);
    const t = setTimeout(() => setPrefillFlash(false), 1800);
    return () => clearTimeout(t);
  }

  const filteredWorkers = useMemo(() => {
    const q = workerQuery.trim().toLowerCase();
    if (!q) return staffList;
    return staffList.filter((s) => {
      const reg = String(s.reg_no);
      return (
        reg.includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.department.toLowerCase().includes(q)
      );
    });
  }, [staffList, workerQuery]);

  useEffect(() => {
    function onDocDown(e: MouseEvent) {
      if (!workerOpen) return;
      const t = e.target as Node | null;
      if (!t) return;
      if (workerPickerRef.current && !workerPickerRef.current.contains(t)) setWorkerOpen(false);
    }
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [workerOpen]);

  function onActivityChange(id: string) {
    setActivityId(id);
    setCostCenter('');
    setProdCode('');
    setProductSearch('');
    setShowProductList(false);
  }

  function onCostCenterChange(code: string) {
    setCostCenter(code);
    setProdCode('');
    setProductSearch('');
    setShowProductList(false);
  }

  const rowCls = 'flex flex-wrap items-start gap-x-4 gap-y-4';

  return (
    <div className={floorMode ? 'p-4 max-w-7xl mx-auto' : 'p-8 max-w-7xl'}>
      {toastMessage && (
        <Toast
          message={toastMessage}
          onDismiss={() => { setToastMessage(null); setUndoDelete(null); }}
          actionLabel={undoDelete ? 'Undo' : undefined}
          onAction={
            undoDelete
              ? async () => {
                  try {
                    await api.restoreDailyGrading(undoDelete.id);
                    const list = await refreshEntries();
                    setEntries(list);
                    setToastMessage('Undo complete');
                  } catch (e) {
                    alert(e instanceof Error ? e.message : 'Undo failed');
                  }
                }
              : undefined
          }
          durationMs={undoDelete ? 10_000 : undefined}
        />
      )}
      <header className={floorMode ? 'mb-4' : 'mb-8'}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className={floorMode ? 'text-xl font-bold' : 'text-2xl font-bold'}>
              {floorMode ? labels.floorEntry.en : labels.todayProductionEntry.en}
            </h2>
            {showNepali && (
              <p className="text-slate-500 text-xs mt-0.5">
                {floorMode ? labels.floorEntry.ne : labels.todayProductionEntry.ne}
              </p>
            )}
          </div>
          {!floorMode && (
            <label className="flex items-center gap-2 text-xs text-slate-400 select-none mt-1">
              <input
                type="checkbox"
                checked={showNepaliSubtitles}
                onChange={(e) => setShowNepaliSubtitles(e.target.checked)}
              />
              Show Nepali subtitles
            </label>
          )}
        </div>
        <p className="text-slate-400 text-sm mt-1">
          Worker → job type → work station → product → quantity
        </p>
        <ol className="flex flex-wrap gap-2 mt-3 text-[10px] uppercase tracking-wide" aria-label="Entry steps">
          {(['activity', 'costCenter', 'product', 'quantity'] as const).map((step, i) => {
            const stepLabels = {
              activity: labels.stepActivity.en,
              costCenter: labels.stepCostCenter.en,
              product: labels.stepProduct.en,
              quantity: labels.stepQuantity.en,
            };
            const done =
              (step === 'activity' && activityId) ||
              (step === 'costCenter' && costCenter) ||
              (step === 'product' && prodCode) ||
              (step === 'quantity' && quantity);
            const current = nextStep === step;
            return (
              <li
                key={step}
                className={`px-2 py-0.5 rounded-full border ${
                  current
                    ? 'border-amber-500 bg-amber-500/15 text-amber-300'
                    : done
                      ? 'border-emerald-700/50 bg-emerald-900/20 text-emerald-400'
                      : 'border-slate-700 text-slate-500'
                }`}
              >
                {i + 1}. {stepLabels[step]}
              </li>
            );
          })}
        </ol>
      </header>

      <DepartmentBanner />

      <div className="space-y-6">
        <form
          onSubmit={handleSave}
          className={
            floorMode
              ? 'floor-card space-y-3 pb-24 md:pb-4'
              : 'space-y-3 bg-slate-900 border border-slate-800 rounded-xl p-6'
          }
        >
          {/* Row 1: date, department, worker */}
          <div className={rowCls}>
            <div className="w-full sm:w-[17rem] shrink-0">
              <DateInput
                label={labels.entryDate.en}
                subtitle={labels.entryDate.ne}
                showSubtitle={showNepali}
                reserveSubtitleLine={showNepali}
                value={date}
                onChange={setDate}
                aligned
                floorMode={floorMode}
              />
            </div>

            {!deptLocked && (
              <FormField
                label={labels.departmentFilter.en}
                nepali={labels.departmentFilter.ne}
                showSubtitle={showNepali}
                reserveSubtitleLine={showNepali}
                floorMode={floorMode}
                className="flex-1 min-w-[10rem] max-w-xs"
              >
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className={controlCls()}
                  disabled={deptLocked}
                >
                  <option value="">{labels.selectDepartment.en}</option>
                  {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </FormField>
            )}

            <FormField
              label={labels.worker.en}
              nepali={labels.worker.ne}
              showSubtitle={showNepali}
              reserveSubtitleLine={showNepali}
              required
              floorMode={floorMode}
              highlight={nextStep === 'worker'}
              hint={nextStep === 'worker' ? 'Select who did the work' : undefined}
              className="flex-[2] min-w-[12rem]"
            >
              <div ref={workerPickerRef} className="relative w-full">
                <button
                  type="button"
                  onClick={() => setWorkerOpen((v) => !v)}
                  className={`${controlCls()} flex items-center justify-between gap-3`}
                  aria-haspopup="listbox"
                  aria-expanded={workerOpen}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    {selectedWorker?.photo_data ? (
                      <span className="h-7 w-7 rounded-md overflow-hidden border border-slate-700 bg-slate-800 shrink-0">
                        <img src={selectedWorker.photo_data} alt="" className="h-full w-full object-cover" />
                      </span>
                    ) : (
                      <span className="h-7 w-7 rounded-md border border-slate-700 bg-slate-800 shrink-0 flex items-center justify-center text-xs font-semibold text-amber-200/80">
                        {String(selectedWorker?.name || 'W').trim().slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <span className="truncate text-left">
                      {selectedWorker
                        ? `${selectedWorker.reg_no} — ${selectedWorker.name} (${selectedWorker.department})`
                        : labels.selectWorker.en}
                    </span>
                  </span>
                  <span className="text-slate-400">▾</span>
                </button>

                {/* Hidden required input so native form validation still works */}
                <input value={staffId} readOnly required className="sr-only" tabIndex={-1} aria-hidden />

                {workerOpen && (
                  <div className="absolute z-20 w-full top-full mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
                    <div className="p-2 border-b border-slate-800">
                      <input
                        value={workerQuery}
                        onChange={(e) => setWorkerQuery(e.target.value)}
                        placeholder="Search reg #, name, department..."
                        className="w-full h-10 rounded-lg bg-slate-800 border border-slate-700 px-3 text-sm"
                        autoFocus
                      />
                    </div>
                    <ul className="max-h-72 overflow-y-auto" role="listbox" aria-label="Worker list">
                      {filteredWorkers.length === 0 ? (
                        <li className="p-3 text-sm text-slate-400">No workers found</li>
                      ) : filteredWorkers.map((s) => (
                        <li key={s.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setStaffId(String(s.id));
                              addRecentWorker(String(s.id));
                              setWorkerOpen(false);
                              setWorkerQuery('');
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-800"
                            role="option"
                            aria-selected={String(s.id) === staffId}
                          >
                            {s.photo_data ? (
                              <span className="h-9 w-9 rounded-lg overflow-hidden border border-slate-700 bg-slate-800 shrink-0">
                                <img src={s.photo_data} alt="" className="h-full w-full object-cover" />
                              </span>
                            ) : (
                              <span className="h-9 w-9 rounded-lg border border-slate-700 bg-slate-800 shrink-0 flex items-center justify-center text-sm font-semibold text-amber-200/80">
                                {String(s.name || 'W').trim().slice(0, 1).toUpperCase()}
                              </span>
                            )}
                            <span className="min-w-0">
                              <span className="block font-medium text-slate-200 truncate">{s.name}</span>
                              <span className="block text-xs text-slate-400 truncate">
                                <span className="font-mono">Reg {s.reg_no}</span>
                                <span className="mx-2">·</span>
                                {s.department}
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </FormField>
          </div>

          {selectedWorker && (
            <div
              className={
                floorMode
                  ? `rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3 ${prefillFlash ? 'ring-2 ring-amber-400/40' : ''}`
                  : `rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-3 flex flex-wrap items-center justify-between gap-3 ${prefillFlash ? 'ring-2 ring-amber-400/30' : ''}`
              }
              aria-label="Selected worker"
            >
              <div className="flex items-center gap-3 min-w-0">
                {selectedWorker.photo_data ? (
                  <div
                    className={
                      floorMode
                        ? 'h-12 w-12 rounded-xl border border-slate-700 bg-slate-800 overflow-hidden shrink-0'
                        : 'h-10 w-10 rounded-lg border border-slate-700 bg-slate-800 overflow-hidden shrink-0'
                    }
                    title="Worker photo"
                    aria-label="Worker photo"
                  >
                    <img src={selectedWorker.photo_data} alt="" className="h-full w-full object-cover" />
                  </div>
                ) : (
                  <div
                    className={
                      floorMode
                        ? 'h-12 w-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-lg font-bold text-amber-200/90 shrink-0'
                        : 'h-10 w-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-base font-bold text-amber-200/90 shrink-0'
                    }
                    aria-hidden
                    title="Worker"
                  >
                    {String(selectedWorker.name || 'W').trim().slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className={floorMode ? 'text-sm text-amber-200/90 font-semibold' : 'text-sm text-slate-200 font-semibold'}>
                    {selectedWorker.name}
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    <span className="font-mono">Reg {selectedWorker.reg_no}</span>
                    <span className="mx-2">·</span>
                    {selectedWorker.department}
                  </p>
                </div>
              </div>

              <div className="text-[10px] uppercase tracking-wide text-slate-500">
                Confirm selected worker
              </div>
            </div>
          )}

          {can('daily-grading:write') && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={pickNextWorker}
                disabled={!staffId || ungradedWorkers.length === 0}
                className={
                  floorMode
                    ? 'h-12 px-5 rounded-2xl bg-slate-800 border border-slate-700 text-slate-100 font-semibold hover:bg-slate-700 disabled:opacity-40'
                    : 'h-10 px-4 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 font-semibold hover:bg-slate-700 disabled:opacity-40'
                }
                title="Jump to next worker not graded today"
              >
                Next worker →
              </button>
              {recentWorkerIds.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {recentWorkerIds
                    .map((id) => staffList.find((s) => String(s.id) === id))
                    .filter(Boolean)
                    .slice(0, 5)
                    .map((s) => (
                      <button
                        key={s!.id}
                        type="button"
                        onClick={() => setStaffId(String(s!.id))}
                        className={`${floorMode ? 'h-12 px-4 rounded-2xl' : 'h-10 px-3 rounded-xl'} border ${
                          String(s!.id) === staffId
                            ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
                            : 'border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800'
                        }`}
                        title={`Reg ${s!.reg_no}`}
                      >
                        <span className="text-sm font-semibold truncate max-w-[10rem] inline-block">
                          {s!.name}
                        </span>
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Row 2: activity, cost center, product */}
          <div className={rowCls}>
            <FormField
              label={labels.activity.en}
              nepali={labels.activity.ne}
              showSubtitle={showNepali}
              reserveSubtitleLine={showNepali}
              required
              floorMode={floorMode}
              highlight={nextStep === 'activity'}
              hint={
                !staffId
                  ? labels.pickActivityFirst.en
                  : nextStep === 'activity'
                    ? 'Choose job type to continue'
                    : undefined
              }
              hintClassName={!staffId ? 'text-slate-500' : 'text-amber-400/90'}
              className="flex-1 min-w-[10rem] max-w-xs"
            >
              <select
                value={activityId}
                onChange={(e) => onActivityChange(e.target.value)}
                className={controlCls(!staffId)}
                disabled={!staffId}
              >
                <option value="">{labels.selectActivity.en}</option>
                {activities.map((a) => (
                  <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                ))}
              </select>
            </FormField>

            <FormField
              label={labels.costCenter.en}
              nepali={labels.costCenter.ne}
              showSubtitle={showNepali}
              reserveSubtitleLine={showNepali}
              required
              floorMode={floorMode}
              highlight={nextStep === 'costCenter'}
              className="flex-1 min-w-[12rem] max-w-md"
              hint={
                !activityId
                  ? labels.pickJobTypeFirst.en
                  : activityId && costCenters.length === 0
                    ? labels.noCostCentersForJob.en
                    : nextStep === 'costCenter'
                      ? labels.selectWorkStation.en
                      : undefined
              }
              hintClassName={
                !activityId || (activityId && costCenters.length === 0)
                  ? 'text-orange-400'
                  : 'text-amber-400/90'
              }
            >
              <select
                required
                value={costCenter}
                onChange={(e) => onCostCenterChange(e.target.value)}
                className={controlCls(!costCenterEnabled)}
                disabled={!costCenterEnabled || (Boolean(activityId) && costCenters.length === 0)}
              >
                <option value="">{labels.selectWorkStation.en}</option>
                {costCenters.map((cc) => (
                  <option key={cc.code} value={cc.code}>{cc.code} — {cc.name}</option>
                ))}
              </select>
            </FormField>

            <FormField
              label={labels.product.en}
              nepali={labels.product.ne}
              showSubtitle={showNepali}
              reserveSubtitleLine={showNepali}
              required
              floorMode={floorMode}
              highlight={nextStep === 'product'}
              hint={
                !costCenter
                  ? labels.pickWorkStationFirst.en
                  : nextStep === 'product'
                    ? 'Products from Product Master (with a grading rule for this station)'
                    : undefined
              }
              hintClassName={!costCenter ? 'text-orange-400' : 'text-amber-400/90'}
              className="flex-[2] min-w-[14rem]"
            >
              <div className="relative w-full">
                <input
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    setProdCode('');
                    setShowProductList(true);
                  }}
                  onFocus={() => productEnabled && setShowProductList(true)}
                  placeholder={productEnabled ? labels.selectProduct.en : labels.pickWorkStationFirst.en}
                  className={controlCls(!productEnabled)}
                  disabled={!productEnabled}
                />
                {showProductList && products.length > 0 && (
                  <ul className="absolute z-10 w-full top-full mt-1 bg-slate-800 border border-slate-700 rounded-lg max-h-40 overflow-y-auto shadow-xl">
                    {products.map((p) => (
                      <li key={p.prod_code}>
                        <button type="button" onClick={() => selectProduct(p)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-slate-700">
                          <span className="font-mono text-amber-200/90">{p.prod_code}</span>
                          <span className="text-slate-400 ml-2 truncate">{p.prod_name}</span>
                          {p.base_uom && (
                            <span className="text-slate-500 text-xs ml-1">· {p.base_uom}</span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </FormField>
          </div>

          {/* Row 3: quantity, remarks, save */}
          <div className={`${rowCls} items-end`}>
            <FormField
              label={labels.quantity.en}
              nepali={labels.quantity.ne}
              showSubtitle={showNepali}
              reserveSubtitleLine={showNepali}
              required
              floorMode={floorMode}
              highlight={nextStep === 'quantity'}
              hint={
                !prodCode
                  ? labels.selectProductFirst.en
                  : nextStep === 'quantity'
                    ? labels.enterPieces.en
                    : undefined
              }
              hintClassName={!prodCode ? 'text-orange-400' : 'text-amber-400/90'}
              className="w-full sm:w-32 shrink-0"
            >
              <div className="flex w-full items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => String(Math.max(0, (parseInt(q || '0', 10) || 0) - 1)))}
                  disabled={!quantityEnabled}
                  className={
                    floorMode
                      ? `h-12 w-12 rounded-xl border border-slate-700 bg-slate-800 text-xl font-bold ${!quantityEnabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-700'}`
                      : `h-10 w-10 rounded-lg border border-slate-700 bg-slate-800 text-lg font-bold ${!quantityEnabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-700'}`
                  }
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <input
                  ref={quantityInputRef}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(sanitizeNonNegativeIntegerInput(e.target.value))}
                  onKeyDown={blockNegativeNumberKey}
                  className={controlCls(!quantityEnabled)}
                  disabled={!quantityEnabled}
                  placeholder={quantityEnabled ? '0' : '—'}
                />
                <button
                  type="button"
                  onClick={() => setQuantity((q) => String((parseInt(q || '0', 10) || 0) + 1))}
                  disabled={!quantityEnabled}
                  className={
                    floorMode
                      ? `h-12 w-12 rounded-xl border border-slate-700 bg-slate-800 text-xl font-bold ${!quantityEnabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-700'}`
                      : `h-10 w-10 rounded-lg border border-slate-700 bg-slate-800 text-lg font-bold ${!quantityEnabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-700'}`
                  }
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
            </FormField>

            {!floorMode && (
              <FormField
                label={labels.remarks.en}
                nepali={labels.remarks.ne}
                showSubtitle={showNepali}
                reserveSubtitleLine={showNepali}
                floorMode={floorMode}
                className="flex-1 min-w-[10rem] max-w-md"
              >
                <input value={remarks} onChange={(e) => setRemarks(e.target.value)} className={controlCls()} />
              </FormField>
            )}

            <div className={`flex flex-col shrink-0 ${floorMode ? 'w-full md:w-auto' : 'sm:ml-auto'}`}>
              <span
                className={`block invisible select-none mb-1.5 ${floorMode ? 'min-h-[2.25rem]' : 'h-4 leading-4'}`}
                aria-hidden
              >
                <span>Save</span>
                {floorMode && (
                  <span className="block text-[10px] mt-0.5 leading-tight">{'\u00a0'}</span>
                )}
              </span>
              <div className={floorMode ? 'min-h-12 flex items-center' : 'min-h-10 flex items-center'}>
                <button
                  type="submit"
                  disabled={saving || !preview}
                  className={
                    saveSuccess
                      ? floorMode
                        ? 'w-full md:w-auto min-w-[12rem] h-12 md:h-10 px-8 rounded-2xl md:rounded-lg bg-emerald-600 text-white font-bold md:font-semibold text-lg md:text-base shadow-lg md:shadow-none disabled:opacity-100 fixed bottom-16 left-4 right-4 z-20 md:static'
                        : 'w-full sm:w-auto min-w-[12rem] h-10 px-8 rounded-lg bg-emerald-600 text-white font-semibold disabled:opacity-100'
                      : floorMode
                        ? 'w-full md:w-auto min-w-[12rem] h-12 md:h-10 px-8 rounded-2xl md:rounded-lg bg-amber-500 text-slate-900 font-bold md:font-semibold text-lg md:text-base shadow-lg md:shadow-none disabled:opacity-40 fixed bottom-16 left-4 right-4 z-20 md:static'
                        : 'w-full sm:w-auto min-w-[12rem] h-10 px-8 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold disabled:opacity-40'
                  }
                >
                  {saving ? (
                    <span className="inline-flex items-center justify-center gap-2">
                      <Spinner className="h-5 w-5" />
                      Saving…
                    </span>
                  ) : saveSuccess ? (
                    <span className="inline-flex items-center justify-center gap-2">
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Saved
                    </span>
                  ) : preview ? (
                    `Save — Grade ${preview.grade}`
                  ) : (
                    'Save Entry'
                  )}
                </button>
              </div>
              {can('daily-grading:write') && (
                <label className="mt-2 inline-flex items-center gap-2 text-xs text-slate-400 select-none">
                  <input
                    type="checkbox"
                    checked={beepOnSave}
                    onChange={(e) => {
                      const v = e.target.checked;
                      setBeepOnSave(v);
                      localStorage.setItem('mes_beep_on_save', v ? '1' : '0');
                    }}
                    className="h-4 w-4 accent-amber-500"
                  />
                  Beep on save
                </label>
              )}
              <span className="h-4 mt-1 block invisible select-none" aria-hidden>&nbsp;</span>
            </div>
          </div>

          {standard && (
            <div className="text-xs bg-slate-800/80 rounded-lg p-3 space-y-1 text-slate-400">
              <p className="text-slate-300 font-medium truncate">{standard.prod_name}</p>
              <p>Std Qty: {standard.std_qty} · B: {standard.b_value} · A: {standard.a_value} · A+: {standard.aplus_value}</p>
            </div>
          )}

          {preview && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-slate-300">{labels.calculatedGrade.en}</span>
                <GradeBadge grade={preview.grade} size={floorMode ? 'lg' : 'md'} />
                <span className="text-xs text-slate-400 w-full sm:w-auto sm:ml-auto">
                  W Min: <strong className="text-white">{preview.w_min}</strong>
                  <span className="mx-2">·</span>
                  P Hour: <strong className="text-white">{preview.p_hour}</strong>
                </span>
              </div>
            </div>
          )}

          {saveSuccess && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-700/50 bg-emerald-900/25 px-4 py-2.5 text-sm text-emerald-300">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </span>
              Entry saved — worker and product kept; enter the next quantity.
            </div>
          )}

          {missingStandard && prodCode && (
            <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm text-orange-200/90">
              <p className="font-medium">
                This product isn’t set up for{' '}
                <span className="font-semibold text-orange-100">
                  {selectedJobType?.name || 'this job type'}
                </span>
                . Ask supervisor to add a grading rule.
              </p>
              {can('standards:read') ? (
                <p className="text-xs text-orange-200/80 mt-1">
                  <Link
                    to={`/standards?q=${encodeURIComponent(prodCode)}`}
                    className="underline hover:no-underline"
                  >
                    Open grading rules for {prodCode}
                  </Link>
                </p>
              ) : (
                <p className="text-xs text-orange-200/70 mt-1">
                  Tell the supervisor: product code <span className="font-mono">{prodCode}</span>
                </p>
              )}
            </div>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}
        </form>

        <div ref={entriesSectionRef} className={floorMode || entriesView === 'list' ? 'space-y-2' : ''}>
          <div className="flex justify-between items-center mb-3">
            <div>
              <h3 className="font-semibold">Entries for {date}</h3>
              {offlineCount > 0 && (
                <button
                  type="button"
                  onClick={() => syncOfflineQueue().catch(() => {})}
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
              <button type="button" onClick={exportDay} disabled={exporting}
                className="text-xs px-3 py-1.5 rounded-lg border border-emerald-700/50 text-emerald-300 hover:bg-emerald-900/20 disabled:opacity-40">
                {exporting ? 'Exporting...' : labels.exportCsv.en}
              </button>
            </div>
          </div>
          {floorMode ? (
            <div className="space-y-2">
              {entriesView === 'table' ? (
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-sm table-fixed">
                    <colgroup>
                      <col className="w-14" />
                      <col className="w-[22%]" />
                      <col className="w-20" />
                      <col className="w-[28%]" />
                      <col className="w-12" />
                      <col className="w-14" />
                      <col className="w-20" />
                      <col className="w-28" />
                      <col className="w-40" />
                      {canDelete && <col className="w-14" />}
                    </colgroup>
                    <thead className="bg-slate-900 text-slate-400 text-left">
                      <tr>
                        <th className="p-3 whitespace-nowrap">{labels.regNo.en}</th>
                        <th className="p-3 whitespace-nowrap">{labels.worker.en}</th>
                        <th className="p-3 whitespace-nowrap">{labels.product.en}</th>
                        <th className="p-3 whitespace-nowrap">{labels.costCenter.en}</th>
                        <th className="p-3 text-right whitespace-nowrap">Qty</th>
                        <th className="p-3 whitespace-nowrap">Grade</th>
                        <th className="p-3 whitespace-nowrap">Entered by</th>
                        <th className="p-3 whitespace-nowrap">Time</th>
                        <th className="p-3 whitespace-nowrap">Updated</th>
                        {canDelete && <th className="p-3 whitespace-nowrap"></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {entries.length === 0 ? (
                        <tr>
                          <td colSpan={canDelete ? 10 : 9} className="p-6 text-center text-slate-500">
                            No entries for this date — add the first one above.
                          </td>
                        </tr>
                      ) : entriesSorted.map((e) => (
                        <tr
                          key={e.id}
                          id={`entry-row-${e.id}`}
                          className={`border-t border-slate-800 hover:bg-slate-900/50 transition-colors ${entryRowClass(e.id)}`}
                        >
                          <td className="p-3">{e.reg_no}</td>
                          <td className="p-3 truncate">{e.staff_name}</td>
                          <td className="p-3 font-mono text-xs">{e.prod_code}</td>
                          <td className="p-3 text-xs text-slate-400 truncate">{e.cost_center_name || e.cost_center_code}</td>
                          <td className="p-3 text-right font-medium">{e.quantity}</td>
                          <td className="p-3"><GradeBadge grade={e.grade} /></td>
                          <td className="p-3 text-xs text-slate-400">{e.entered_by || '—'}</td>
                          <td className="p-3 text-xs text-slate-400 whitespace-nowrap">{e.created_at || '—'}</td>
                          <td className="p-3 text-xs text-slate-400 whitespace-nowrap">
                            {e.updated_at ? (
                              <>
                                {e.updated_by ? <span className="text-slate-300">{e.updated_by}</span> : 'Updated'}
                                <span className="ml-2 text-slate-500">{e.updated_at}</span>
                              </>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                          {canDelete && (
                            <td className="p-3">
                              <button type="button" onClick={() => handleDelete(e.id)}
                                className="text-red-400 hover:text-red-300 text-xs">Delete</button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : entriesSorted.length === 0 ? (
                <div className="text-center text-slate-500 py-4">
                  No entries for this date — add the first one above.
                </div>
              ) : (
                <>
                  <div className="sticky top-0 z-10 -mx-4 px-4 py-2 bg-slate-950/85 backdrop-blur border-b border-slate-800">
                    <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-2">Last 3 entries</p>
                    <ul className="space-y-2">
                      {last3.map((e) => (
                        <li
                          key={e.id}
                          id={`entry-row-${e.id}`}
                          className={`flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl p-3 transition-colors ${entryRowClass(e.id)}`}
                        >
                          <div className="min-w-0">
                            <p className="font-medium truncate">{e.staff_name}</p>
                            <p className="text-xs text-slate-400 font-mono">
                              {e.prod_code} · Qty {e.quantity}
                              {e.entered_by && (
                                <span className="ml-2 text-slate-500">· {e.entered_by}</span>
                              )}
                              {e.created_at && (
                                <span className="ml-2 text-slate-500">{e.created_at}</span>
                              )}
                            </p>
                          </div>
                          <GradeBadge grade={e.grade} size="lg" />
                        </li>
                      ))}
                    </ul>
                  </div>
                  <ul className="space-y-2">
                    {entriesSorted.slice(3).map((e) => (
                      <li
                        key={e.id}
                        id={`entry-row-${e.id}`}
                        className={`flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl p-3 transition-colors ${entryRowClass(e.id)}`}
                      >
                        <div className="min-w-0">
                          <p className="font-medium truncate">{e.staff_name}</p>
                          <p className="text-xs text-slate-400 font-mono">
                            {e.prod_code} · Qty {e.quantity}
                            {e.entered_by && (
                              <span className="ml-2 text-slate-500">· {e.entered_by}</span>
                            )}
                            {e.created_at && (
                              <span className="ml-2 text-slate-500">{e.created_at}</span>
                            )}
                          </p>
                        </div>
                        <GradeBadge grade={e.grade} />
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          ) : (
          entriesView === 'table' ? (
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-sm table-fixed">
                <colgroup>
                  <col className="w-14" />
                  <col className="w-[22%]" />
                  <col className="w-20" />
                  <col className="w-[28%]" />
                  <col className="w-12" />
                  <col className="w-14" />
                  <col className="w-20" />
                  <col className="w-28" />
                  <col className="w-40" />
                  {canDelete && <col className="w-14" />}
                </colgroup>
                <thead className="bg-slate-900 text-slate-400 text-left">
                  <tr>
                    <th className="p-3 whitespace-nowrap">{labels.regNo.en}</th>
                    <th className="p-3 whitespace-nowrap">{labels.worker.en}</th>
                    <th className="p-3 whitespace-nowrap">{labels.product.en}</th>
                    <th className="p-3 whitespace-nowrap">{labels.costCenter.en}</th>
                    <th className="p-3 text-right whitespace-nowrap">Qty</th>
                    <th className="p-3 whitespace-nowrap">Grade</th>
                    <th className="p-3 whitespace-nowrap">Entered by</th>
                    <th className="p-3 whitespace-nowrap">Time</th>
                    <th className="p-3 whitespace-nowrap">Updated</th>
                    {canDelete && <th className="p-3 whitespace-nowrap"></th>}
                  </tr>
                </thead>
                <tbody>
                  {entries.length === 0 ? (
                    <tr>
                      <td colSpan={canDelete ? 10 : 9} className="p-6 text-center text-slate-500">
                        No entries for this date — add the first one above.
                      </td>
                    </tr>
                  ) : entries.map((e) => (
                    <tr
                      key={e.id}
                      id={`entry-row-${e.id}`}
                      className={`border-t border-slate-800 hover:bg-slate-900/50 transition-colors ${entryRowClass(e.id)}`}
                    >
                      <td className="p-3">{e.reg_no}</td>
                      <td className="p-3 truncate">{e.staff_name}</td>
                      <td className="p-3 font-mono text-xs">{e.prod_code}</td>
                      <td className="p-3 text-xs text-slate-400 truncate">{e.cost_center_name || e.cost_center_code}</td>
                      <td className="p-3 text-right font-medium">{e.quantity}</td>
                      <td className="p-3"><GradeBadge grade={e.grade} /></td>
                      <td className="p-3 text-xs text-slate-400">{e.entered_by || '—'}</td>
                      <td className="p-3 text-xs text-slate-400 whitespace-nowrap">{e.created_at || '—'}</td>
                      <td className="p-3 text-xs text-slate-400 whitespace-nowrap">
                        {e.updated_at ? (
                          <>
                            {e.updated_by ? <span className="text-slate-300">{e.updated_by}</span> : 'Updated'}
                            <span className="ml-2 text-slate-500">{e.updated_at}</span>
                          </>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      {canDelete && (
                        <td className="p-3">
                          <button type="button" onClick={() => handleDelete(e.id)}
                            className="text-red-400 hover:text-red-300 text-xs">Delete</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="space-y-2">
              {entries.length === 0 ? (
                <div className="text-center text-slate-500 py-4">
                  No entries for this date — add the first one above.
                </div>
              ) : (
                <ul className="space-y-2">
                  {[...entries].slice().reverse().map((e) => (
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
                          {e.updated_at && <span className="ml-2 text-slate-600">· upd {e.updated_by || '—'} {e.updated_at}</span>}
                        </p>
                      </div>
                      <GradeBadge grade={e.grade} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
          )}
        </div>
      </div>
    </div>
  );
}
