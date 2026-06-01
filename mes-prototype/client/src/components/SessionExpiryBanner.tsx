export default function SessionExpiryBanner({
  message,
  onRenew,
  renewing,
}: {
  message: string;
  onRenew: () => void;
  renewing?: boolean;
}) {
  return (
    <div
      className="mx-4 mt-3 md:mx-6 md:mt-4 rounded-xl border border-amber-500/40 bg-amber-500/15 px-4 py-3 flex flex-wrap items-center justify-between gap-3 print:hidden"
      role="status"
    >
      <p className="text-sm text-amber-100">{message}</p>
      <button
        type="button"
        onClick={onRenew}
        disabled={renewing}
        className="shrink-0 px-4 py-1.5 rounded-lg bg-amber-500 text-slate-900 text-sm font-semibold disabled:opacity-50"
      >
        {renewing ? 'Renewing…' : 'Stay signed in'}
      </button>
    </div>
  );
}
