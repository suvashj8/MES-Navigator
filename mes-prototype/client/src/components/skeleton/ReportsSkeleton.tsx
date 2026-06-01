import { Skeleton } from './Skeleton';

function ScorecardRowSkeleton() {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[200px] space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-28" />
        </div>
        <Skeleton className="h-12 w-16 rounded-lg" />
        <Skeleton className="h-12 w-20 rounded-lg" />
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-12 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>
    </div>
  );
}

export default function ReportsSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading scorecards">
      <span className="sr-only">Loading scorecards…</span>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-24" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <ScorecardRowSkeleton key={i} />
      ))}
    </div>
  );
}
