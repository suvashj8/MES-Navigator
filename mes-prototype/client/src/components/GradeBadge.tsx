const colors: Record<string, string> = {
  C: 'bg-red-500/20 text-red-300 border-red-500/40',
  B: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  A: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  AA: 'bg-amber-500/20 text-amber-200 border-amber-400/50',
};

type Props = { grade: string; size?: 'sm' | 'md' | 'lg'; className?: string };

export default function GradeBadge({ grade, size = 'md', className = '' }: Props) {
  const sizeCls =
    size === 'lg'
      ? 'min-w-[3rem] px-3 py-1 rounded-lg text-sm'
      : size === 'sm'
        ? 'min-w-[1.75rem] px-2 py-0.5 rounded-md text-[11px]'
        : 'min-w-[2rem] px-2 py-0.5 rounded-md text-xs';

  return (
    <span
      className={`inline-flex items-center justify-center border font-bold ${sizeCls} ${colors[grade] || 'bg-slate-700 text-slate-300'} ${className}`}
    >
      {grade}
    </span>
  );
}
