import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DailyEntryInput } from '../../../api';
import { loadOfflineQueue, offlineQueueKey, saveOfflineQueue, syncOfflineQueue as syncQueue } from '../../../offlineQueue';

export function useOfflineSync(username: string | undefined) {
  const offlineKey = useMemo(() => offlineQueueKey(username), [username]);
  const [offlineCount, setOfflineCount] = useState(0);

  const updateOfflineCount = useCallback(() => {
    setOfflineCount(loadOfflineQueue(offlineKey).length);
  }, [offlineKey]);

  const syncOffline = useCallback(
    async (onSynced?: () => Promise<void>) => {
      if (!navigator.onLine) {
        const remaining = loadOfflineQueue(offlineKey).length;
        return { synced: 0, remaining };
      }
      const { synced, remaining } = await syncQueue(offlineKey, { max: 50 });
      setOfflineCount(remaining);
      if (synced > 0 && onSynced) await onSynced();
      return { synced, remaining };
    },
    [offlineKey]
  );

  const enqueueOffline = useCallback(
    (payload: DailyEntryInput) => {
      const q = loadOfflineQueue(offlineKey);
      const key = `${payload.entry_date}|${payload.staff_id}|${payload.prod_code}|${payload.cost_center_code}`;
      const deduped = q.filter(
        (it) => `${it.entry_date}|${it.staff_id}|${it.prod_code}|${it.cost_center_code}` !== key
      );
      deduped.unshift(payload);
      saveOfflineQueue(offlineKey, deduped.slice(0, 50));
      updateOfflineCount();
    },
    [offlineKey, updateOfflineCount]
  );

  useEffect(() => {
    updateOfflineCount();
  }, [updateOfflineCount]);

  useEffect(() => {
    const onOnline = () => {
      syncOffline().catch(() => {});
    };
    window.addEventListener('online', onOnline);
    syncOffline().catch(() => {});
    return () => window.removeEventListener('online', onOnline);
  }, [syncOffline]);

  return { offlineKey, offlineCount, updateOfflineCount, syncOffline, enqueueOffline };
}
