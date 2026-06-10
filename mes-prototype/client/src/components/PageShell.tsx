import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  className?: string;
  /** `narrow` for profile/users forms; `full` for Product Master (no max-width cap). */
  variant?: 'default' | 'narrow' | 'full';
};

const variantClass: Record<NonNullable<Props['variant']>, string> = {
  default: 'max-w-[1600px]',
  narrow: 'max-w-3xl',
  full: 'max-w-[96rem]',
};

/** Centered page content — layout rhythm matches fixed-asset PageShell. */
export default function PageShell({ children, className = '', variant = 'default' }: Props) {
  return (
    <div className={`mes-page w-full space-y-4 sm:space-y-6 ${variantClass[variant]} ${className}`}>
      {children}
    </div>
  );
}
