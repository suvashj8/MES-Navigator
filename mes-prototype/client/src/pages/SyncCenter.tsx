import { useEffect, useMemo, useState } from 'react';
import { api, type Staff } from '../api';
import PageShell from '../components/PageShell';
import Toast from '../components/Toast';
import { loadOfflineQueue, offlineQueueKey, saveOfflineQueue, syncOfflineQueue, type OfflineQueueItem } from '../offlineQueue';
import { useAuth } from '../hooks/useAuth';
import { useConfirm } from '../hooks/useConfirm';
import { displayStaffRegNo } from '../utils/staffRegNo';

export default function SyncCenter() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const key = useMemo(() => offlineQueueKey(user?.username), [user?.username]);
  const [items, setItems] = useState<OfflineQueueItem[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function reload() {
    setItems(loadOfflineQueue(key));
  }

  useEffect(() => {
    reload();
    api.staff().then(setStaff).catch(() => setStaff([]));
  }, [key]);

  const staffById = useMemo(() => {
    const m = new Map<number, Staff>();
    for (const s of staff) m.set(s.id, s);
    return m;
  }, [staff]);

  async function syncNow() {
    if (!navigator.onLine) {
      setToast('You are offline. Connect to the internet to sync.');
      return;
    }
    setSyncing(true);
    try {
      const r = await syncOfflineQueue(key, { max: 200 });
      reload();
      setToast(r.synced > 0 ? `Synced ${r.synced} entries` : 'Nothing to sync');
    } finally {
      setSyncing(false);
    }
  }

  function removeAt(idx: number) {
    const next = items.filter((_, i) => i !== idx);
    saveOfflineQueue(key, next);
    setItems(next);
  }

  async function clearAll() {
    const ok = await confirm({
      title: 'Clear offline queue',
      message: 'Clear all queued offline entries?',
      confirmLabel: 'Clear all',
      variant: 'danger',
    });
    if (!ok) return;
    saveOfflineQueue(key, []);
    setItems([]);
    setToast('Cleared offline queue');
  }

  return (
    <PageShell>
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} durationMs={2500} />}

      <header className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold">Sync Center</h2>
          <p className="text-slate-400 text-sm mt-1">
            Offline entries are saved on this device and synced when online.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={syncNow}
            disabled={syncing || items.length === 0}
            className="px-4 py-2 rounded-lg bg-amber-500 text-slate-900 font-semibold text-sm disabled:opacity-40"
          >
            {syncing ? 'Syncing…' : 'Sync now'}
          </button>
          <button
            type="button"
            onClick={clearAll}
            disabled={items.length === 0}
            className="px-4 py-2 rounded-lg border border-slate-700 text-sm disabled:opacity-40"
          >
            Clear
          </button>
        </div>
      </header>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6">
        <p className="text-sm">
          Status:{' '}
          <span className={navigator.onLine ? 'text-emerald-300' : 'text-orange-300'}>
            {navigator.onLine ? 'Online' : 'Offline'}
          </span>
          <span className="mx-2 text-slate-600">·</span>
          Pending: <strong className="text-slate-200">{items.length}</strong>
        </p>
      </div>

      {items.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500">
          No offline entries waiting to sync.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-slate-400 text-left">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Worker</th>
                <th className="p-3">Product</th>
                <th className="p-3">Work station</th>
                <th className="p-3 text-right">Qty</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => {
                const s = staffById.get(it.staff_id);
                return (
                  <tr key={`${it.entry_date}-${it.staff_id}-${it.prod_code}-${it.cost_center_code}-${idx}`} className="border-t border-slate-800">
                    <td className="p-3 whitespace-nowrap">{it.entry_date}</td>
                    <td className="p-3">
                      {s ? (
                        <>
                          <p className="font-medium truncate">{s.name}</p>
                          <p className="text-xs text-slate-500">{displayStaffRegNo(s)} · {s.department}</p>
                        </>
                      ) : (
                        <span className="text-slate-500">Staff #{it.staff_id}</span>
                      )}
                    </td>
                    <td className="p-3 font-mono text-xs">{it.prod_code}</td>
                    <td className="p-3 text-xs text-slate-400">{it.cost_center_code}</td>
                    <td className="p-3 text-right font-semibold">{it.quantity}</td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => removeAt(idx)}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}

