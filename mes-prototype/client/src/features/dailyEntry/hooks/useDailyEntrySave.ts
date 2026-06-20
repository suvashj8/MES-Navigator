import { useRef, useState, type FormEvent, type RefObject } from 'react';
import { api, type DailyEntry, type GradePreviewResult, type Staff } from '../../../api';
import { useConfirm } from '../../../hooks/useConfirm';
import { parseNonNegativeNumber } from '../../../utils/numericInput';
import { formatStaffRegNo } from '../../../utils/staffRegNo';
import type { DailyEntryInput } from '../../../api';

export function useDailyEntrySave(opts: {
  date: string;
  staffId: string;
  prodCode: string;
  costCenter: string;
  quantity: string;
  remarks: string;
  preview: GradePreviewResult | null;
  entries: DailyEntry[];
  staffList: Staff[];
  beepOnSave: boolean;
  quantityInputRef: RefObject<HTMLInputElement | null>;
  refreshEntries: () => Promise<DailyEntry[]>;
  setEntries: (list: DailyEntry[]) => void;
  setHighlightEntryId: (id: number) => void;
  enqueueOffline: (payload: DailyEntryInput) => void;
  onToast: (msg: string) => void;
}) {
  const confirm = useConfirm();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const saveSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function playBeep() {
    if (!opts.beepOnSave) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
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
    } catch {
      /* ignore */
    }
  }

  async function handleSave(
    e: FormEvent,
    clearForm: () => void
  ) {
    e.preventDefault();
    setError('');
    const { preview, staffId, prodCode, costCenter, quantity, date, entries, staffList, remarks } = opts;
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
      const overwrite = await confirm({
        title: 'Overwrite entry?',
        message:
          'This worker already has an entry for this product/work station today. Overwrite it?',
        confirmLabel: 'Overwrite',
        variant: 'default',
      });
      if (!overwrite) return;
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

      clearForm();
      requestAnimationFrame(() => {
        const el = opts.quantityInputRef.current;
        if (!el || (el as HTMLInputElement).disabled) return;
        el.focus();
        el.select?.();
      });

      playBeep();
      const name = worker?.name ?? 'Worker';
      const reg = worker ? formatStaffRegNo(worker.reg_no) : saved.reg_no != null ? formatStaffRegNo(saved.reg_no) : '—';
      opts.onToast(`Saved — Grade ${grade} for ${name} (${reg})`);
      setSaveSuccess(true);
      if (saveSuccessTimerRef.current) clearTimeout(saveSuccessTimerRef.current);
      saveSuccessTimerRef.current = setTimeout(() => setSaveSuccess(false), 2800);

      const list = await opts.refreshEntries();
      opts.setEntries(list);
      opts.setHighlightEntryId(saved.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      const looksOffline =
        !navigator.onLine || /failed to fetch|networkerror|load failed/i.test(msg);
      if (looksOffline) {
        opts.enqueueOffline({
          entry_date: date,
          staff_id: Number(staffId),
          prod_code: prodCode,
          cost_center_code: costCenter,
          quantity: parseNonNegativeNumber(quantity),
          remarks,
        });
        opts.onToast('Saved offline — will sync when online');
        setError('');
      } else {
        setError(msg);
      }
    } finally {
      setSaving(false);
    }
  }

  return {
    saving,
    error,
    saveSuccess,
    saveSuccessTimerRef,
    handleSave,
    setError,
  };
}
