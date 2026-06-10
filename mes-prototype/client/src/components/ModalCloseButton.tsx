import { cn } from '@/lib/utils';

/** Visible close control for modals/forms (light + dark surfaces). */
export const modalCloseClassName =
  'mes-modal-close inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-base font-bold leading-none text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

type Props = {
  onClick: () => void;
  className?: string;
  'aria-label'?: string;
};

export default function ModalCloseButton({
  onClick,
  className,
  'aria-label': ariaLabel = 'Close',
}: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(modalCloseClassName, className)}
    >
      X
    </button>
  );
}
