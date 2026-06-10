import { useEffect, useId, useRef } from 'react';
import ModalCloseButton from './ModalCloseButton';

export type ConfirmDialogProps = {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  open,
  title = 'Confirm',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => confirmRef.current?.focus(), 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onCancel]);

  if (!open) return null;

  const confirmCls =
    variant === 'danger'
      ? 'bg-red-600 hover:bg-red-500 text-white'
      : 'bg-amber-500 hover:bg-amber-400 text-slate-900';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <ModalCloseButton onClick={onCancel} className="absolute right-3 top-3 z-10" />
        <div className="p-5 pt-4 border-b border-slate-800">
          <h2 id={titleId} className="text-lg font-semibold text-slate-100 pr-10">
            {title}
          </h2>
          <p className="mt-2 text-sm text-slate-300 whitespace-pre-line">{message}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2 p-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800 text-sm font-medium"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${confirmCls}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
