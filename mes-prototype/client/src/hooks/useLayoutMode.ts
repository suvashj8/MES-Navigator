import { useEffect, useState } from 'react';

/** Tailwind `md` — left sidebar, no bottom nav (tablet landscape + laptop + large monitors). */
export const DESKTOP_LAYOUT_MQ = '(min-width: 768px)';

export type LayoutMode = 'mobile' | 'desktop';

function readLayoutMode(): LayoutMode {
  if (typeof window === 'undefined') return 'desktop';
  return window.matchMedia(DESKTOP_LAYOUT_MQ).matches ? 'desktop' : 'mobile';
}

/**
 * Mobile vs desktop chrome is based on **viewport width**, not physical screen size.
 * Maximized browser on a large monitor → desktop. Narrow window on a large monitor → mobile.
 */
export function useLayoutMode(): LayoutMode {
  const [mode, setMode] = useState<LayoutMode>(readLayoutMode);

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_LAYOUT_MQ);
    const onChange = () => setMode(mq.matches ? 'desktop' : 'mobile');
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return mode;
}

export function useIsDesktopLayout(): boolean {
  return useLayoutMode() === 'desktop';
}
