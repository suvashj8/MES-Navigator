import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type DailyEntry } from '../../../api';
import { useConfirm } from '../../../hooks/useConfirm';

export function useDailyEntryEntries(date: string, department: string, floorMode: boolean) {
  const confirm = useConfirm();
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [highlightEntryId, setHighlightEntryId] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [entriesView, setEntriesView] = useState<'list' | 'table'>(() => (floorMode ? 'list' : 'table'));
  const [undoDelete, setUndoDelete] = useState<DailyEntry | null>(null);
  const entriesSectionRef = useRef<HTMLDivElement>(null);

  const refreshEntries = useCallback(() => {
    return api.dailyGrading({ date, department: department || undefined });
  }, [date, department]);

  useEffect(() => {
    refreshEntries().then(setEntries).catch(console.error);
  }, [refreshEntries]);

  useEffect(() => {
    if (!highlightEntryId) return;
    const row = document.getElementById(`entry-row-${highlightEntryId}`);
    if (!row) return;
    entriesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    requestAnimationFrame(() => row.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
    const t = setTimeout(() => setHighlightEntryId(null), 3500);
    return () => clearTimeout(t);
  }, [highlightEntryId, entries]);

  const entriesSorted = floorMode
    ? [...entries].sort((a, b) => (b.id || 0) - (a.id || 0))
    : entries;
  const last3 = floorMode ? entriesSorted.slice(0, 3) : [];

  function entryRowClass(entryId: number) {
    return entryId === highlightEntryId
      ? 'ring-2 ring-emerald-500/50 bg-emerald-900/25 animate-[entry-flash_1.4s_ease-out]'
      : '';
  }

  async function exportDay(onToast: (msg: string) => void) {
    setExporting(true);
    try {
      onToast(`Preparing daily-grading-${date}.csv…`);
      const blob = await api.exportDailyGradingCsv(date, department || undefined);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `daily-grading-${date}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onToast(`Downloaded daily-grading-${date}.csv`);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  async function deleteEntry(id: number) {
    const ok = await confirm({
      title: 'Delete entry',
      message: 'Delete this entry?',
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return null;
    const deleted = entries.find((e) => e.id === id);
    await api.deleteDailyGrading(id);
    const list = await refreshEntries();
    setEntries(list);
    return deleted ?? null;
  }

  async function undoDeleteEntry(entry: DailyEntry) {
    await api.restoreDailyGrading(entry.id);
    const list = await refreshEntries();
    setEntries(list);
  }

  return {
    entries,
    setEntries,
    refreshEntries,
    highlightEntryId,
    setHighlightEntryId,
    exporting,
    entriesView,
    setEntriesView,
    undoDelete,
    setUndoDelete,
    entriesSectionRef,
    entriesSorted,
    last3,
    entryRowClass,
    exportDay,
    deleteEntry,
    undoDeleteEntry,
  };
}
