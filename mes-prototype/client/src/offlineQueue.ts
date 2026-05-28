import { api, type DailyEntryInput } from './api';

export type OfflineQueueItem = DailyEntryInput;

export function offlineQueueKey(username?: string | null) {
  return `mes_offline_queue_${username || 'anon'}`;
}

export function loadOfflineQueue(key: string): OfflineQueueItem[] {
  try {
    const raw = localStorage.getItem(key);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? (arr as OfflineQueueItem[]) : [];
  } catch {
    return [];
  }
}

export function saveOfflineQueue(key: string, items: OfflineQueueItem[]) {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

export async function syncOfflineQueue(key: string, opts?: { max?: number }) {
  const max = Math.min(200, Math.max(1, opts?.max ?? 50));
  const q = loadOfflineQueue(key);
  if (q.length === 0) return { synced: 0, remaining: 0 };
  let remaining = [...q];
  let synced = 0;
  for (const item of q.slice(0, max)) {
    try {
      await api.saveDailyGrading(item);
      remaining = remaining.filter((x) => x !== item);
      synced += 1;
      saveOfflineQueue(key, remaining);
    } catch {
      break;
    }
  }
  return { synced, remaining: remaining.length };
}

