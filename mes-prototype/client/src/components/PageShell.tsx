import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  className?: string;
  /** `narrow` for profile/users forms; `full` for Product Master (no max-width cap). */
  variant?: 'default' | 'narrow' | 'full';
};

const variantClass: Record<NonNullable<Props['variant']>, string> = {
  default: 'max-w-7xl 2xl:max-w-[96rem]',
  narrow: 'max-w-3xl',
  full: 'max-w-[96rem]',
};

/** Centered page content that expands sensibly on large / ultrawide screens. */
export default function PageShell({ children, className = '', variant = 'default' }: Props) {
  return (
    <div className={`mes-page w-full mx-auto p-4 md:p-8 ${variantClass[variant]} ${className}`}>
      {children}
    </div>
  );
}
