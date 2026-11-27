import { useState, useEffect, useCallback, useMemo, useSyncExternalStore } from 'react';
import { ThemeContext, THEME_STORAGE_KEY } from './themeContext';

const VALID = ['light', 'dark', 'system'];
const QUERY = '(prefers-color-scheme: dark)';

const readStored = () => {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return VALID.includes(v) ? v : 'light'; // default: light (the brand design); 'system' is an explicit choice
  } catch {
    return 'light';
  }
};

// Subscribe to the OS colour-scheme preference (used when the theme is 'system').
const subscribeSystem = (cb) => {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
};
const systemIsDark = () => window.matchMedia(QUERY).matches;

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readStored);
  const prefersDark = useSyncExternalStore(subscribeSystem, systemIsDark, () => false);
  const resolvedTheme = theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme;

  // Reflect the resolved theme on <html> (the inline script in index.html does this before first paint).
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme);
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  // Keep several tabs in sync.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === THEME_STORAGE_KEY) setThemeState(VALID.includes(e.newValue) ? e.newValue : 'light');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setTheme = useCallback((next) => {
    const t = VALID.includes(next) ? next : 'system';
    setThemeState(t);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, t);
    } catch {
      /* storage unavailable: the choice just won't persist */
    }
  }, []);

  const toggleTheme = useCallback(() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark'), [resolvedTheme, setTheme]);

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme, toggleTheme }), [theme, resolvedTheme, setTheme, toggleTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
