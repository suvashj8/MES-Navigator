/** Base shimmer block for loading placeholders. */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-md bg-slate-800/90 skeleton-shimmer ${className}`.trim()}
      aria-hidden
    />
  );
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-xl border border-slate-800 bg-slate-900 p-5 skeleton-shimmer ${className}`.trim()}
      aria-hidden
    >
      <Skeleton className="h-3 w-24 mb-3" />
      <Skeleton className="h-8 w-16" />
    </div>
  );
}
