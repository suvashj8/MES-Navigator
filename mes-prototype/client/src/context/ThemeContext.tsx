import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type Theme = 'dark' | 'light';

type ThemeContextValue = {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyThemeClass(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle('theme-light', theme === 'light');
  root.classList.toggle('theme-dark', theme === 'dark');
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');

  useEffect(() => {
    const stored = localStorage.getItem('mes_theme') as Theme | null;
    const initial: Theme = stored === 'light' || stored === 'dark' ? stored : 'dark';
    setThemeState(initial);
    applyThemeClass(initial);
  }, []);

  function setTheme(t: Theme) {
    setThemeState(t);
    localStorage.setItem('mes_theme', t);
    applyThemeClass(t);
  }

  function toggle() {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }

  const value = useMemo(() => ({ theme, toggle, setTheme }), [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

