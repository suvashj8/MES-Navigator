const gradeClass: Record<string, string> = {
  C: 'mes-grade-badge mes-grade-badge--c',
  B: 'mes-grade-badge mes-grade-badge--b',
  A: 'mes-grade-badge mes-grade-badge--a',
  AA: 'mes-grade-badge mes-grade-badge--aa',
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
      className={`inline-flex items-center justify-center border font-bold ${sizeCls} ${gradeClass[grade] || 'bg-slate-700 text-slate-300'} ${className}`}
    >
      {grade}
    </span>
  );
}
