import { useEffect } from 'react';

type Props = {
  message: string;
  onDismiss: () => void;
  durationMs?: number;
  actionLabel?: string;
  onAction?: () => void;
};

export default function Toast({
  message,
  onDismiss,
  durationMs = 4500,
  actionLabel,
  onAction,
}: Props) {
  useEffect(() => {
    const t = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(t);
  }, [message, durationMs, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-4 right-4 md:left-auto md:right-6 md:max-w-md top-20 md:top-4 z-50 flex items-start gap-3 rounded-xl border border-emerald-600/40 bg-emerald-950/95 text-emerald-50 shadow-xl shadow-emerald-950/50 px-4 py-3 backdrop-blur-sm animate-[toast-in_0.25s_ease-out]"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </span>
      <div className="min-w-0 flex-1 pr-10">
        <p className="text-sm font-medium leading-snug pt-1">{message}</p>
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={() => { onAction(); onDismiss(); }}
            className="mt-1 text-xs text-emerald-200 underline hover:no-underline"
          >
            {actionLabel}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="absolute top-2 right-2 text-emerald-400/80 hover:text-emerald-200 text-lg leading-none"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
