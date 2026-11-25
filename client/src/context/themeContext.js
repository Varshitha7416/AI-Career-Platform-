import { createContext } from 'react';

export const THEME_STORAGE_KEY = 'careernest-theme';

// { theme: 'light'|'dark'|'system', resolvedTheme: 'light'|'dark', setTheme(t), toggleTheme() }
export const ThemeContext = createContext({
  theme: 'light',
  resolvedTheme: 'light',
  setTheme: () => {},
  toggleTheme: () => {},
});
