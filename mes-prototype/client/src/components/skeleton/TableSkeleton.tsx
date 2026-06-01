import { Skeleton } from './Skeleton';

export default function TableSkeleton({
  columns = 6,
  rows = 8,
  label = 'Loading table',
}: {
  columns?: number;
  rows?: number;
  label?: string;
}) {
  return (
    <div
      className="overflow-x-auto rounded-xl border border-slate-800"
      role="status"
      aria-label={label}
    >
      <span className="sr-only">{label}…</span>
      <table className="w-full text-sm">
        <thead className="bg-slate-900">
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="p-3">
                <Skeleton className="h-3 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r} className="border-t border-slate-800">
              {Array.from({ length: columns }).map((_, c) => (
                <td key={c} className="p-3">
                  <Skeleton className={`h-4 ${c === 0 ? 'w-32' : 'w-full max-w-[8rem]'}`} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
