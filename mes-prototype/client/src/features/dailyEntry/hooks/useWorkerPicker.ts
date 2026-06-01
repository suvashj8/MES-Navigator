import { useEffect, useMemo, useRef, useState } from 'react';
import type { DailyEntry, Staff } from '../../../api';

export function useWorkerPicker(opts: {
  staffList: Staff[];
  entries: DailyEntry[];
  prefillStaffId: string;
  recentKey: string;
}) {
  const { staffList, entries, prefillStaffId, recentKey } = opts;

  const [staffId, setStaffId] = useState('');
  const [workerOpen, setWorkerOpen] = useState(false);
  const [workerQuery, setWorkerQuery] = useState('');
  const [prefillFlash, setPrefillFlash] = useState(false);
  const [recentWorkerIds, setRecentWorkerIds] = useState<string[]>([]);
  const workerPickerRef = useRef<HTMLDivElement>(null);
  const didPrefillRef = useRef(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(recentKey);
      const arr = stored ? (JSON.parse(stored) as string[]) : [];
      if (Array.isArray(arr)) setRecentWorkerIds(arr.filter(Boolean).slice(0, 6));
    } catch {
      /* ignore */
    }
  }, [recentKey]);

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
    if (didPrefillRef.current || !prefillStaffId || staffList.length === 0) return;
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
    setRecentWorkerIds((prev) => [staffId, ...prev.filter((x) => x !== staffId)].slice(0, 6));
  }, [staffId]);

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

  const selectedWorker = staffId ? staffList.find((s) => s.id === Number(staffId)) : undefined;

  const gradedWorkerIds = useMemo(() => new Set(entries.map((e) => e.staff_id)), [entries]);
  const ungradedWorkers = useMemo(
    () => staffList.filter((s) => !gradedWorkerIds.has(s.id)),
    [staffList, gradedWorkerIds]
  );

  const filteredWorkers = useMemo(() => {
    const q = workerQuery.trim().toLowerCase();
    if (!q) return staffList;
    return staffList.filter((s) => {
      const reg = String(s.reg_no);
      return reg.includes(q) || s.name.toLowerCase().includes(q) || s.department.toLowerCase().includes(q);
    });
  }, [staffList, workerQuery]);

  function pickNextWorker() {
    if (ungradedWorkers.length === 0) return;
    const cur = Number(staffId || 0);
    const idx = ungradedWorkers.findIndex((s) => s.id === cur);
    const next = idx >= 0 ? ungradedWorkers[(idx + 1) % ungradedWorkers.length] : ungradedWorkers[0];
    setStaffId(String(next.id));
    setPrefillFlash(true);
    setTimeout(() => setPrefillFlash(false), 1800);
  }

  return {
    staffId,
    setStaffId,
    workerOpen,
    setWorkerOpen,
    workerQuery,
    setWorkerQuery,
    workerPickerRef,
    prefillFlash,
    recentWorkerIds,
    selectedWorker,
    filteredWorkers,
    ungradedWorkers,
    pickNextWorker,
    addRecentWorker,
  };
}
