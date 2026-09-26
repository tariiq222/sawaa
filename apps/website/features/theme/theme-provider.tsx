'use client';

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';

export type Theme = 'light' | 'dark';

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
};

const STORAGE_KEY = 'sawaa-theme';
const THEME_CHANGE_EVENT = 'sawaa-theme-change';
const DEFAULT_THEME: ThemeContextValue = { theme: 'light', toggleTheme: () => {} };
const ThemeContext = createContext<ThemeContextValue>(DEFAULT_THEME);

function savedCookieTheme(): Theme | null {
  const value = document.cookie.match(/(?:^|; )sawaa-theme=(light|dark)(?:;|$)/)?.[1];
  return value === 'light' || value === 'dark' ? value : null;
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

function getTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function getServerTheme(): Theme {
  return 'light';
}

function subscribeToThemeChange(onChange: () => void) {
  const media = window.matchMedia?.('(prefers-color-scheme: dark)');
  const syncSystemTheme = (event: MediaQueryListEvent) => {
      let hasExplicitChoice = false;
      try {
        hasExplicitChoice = localStorage.getItem(STORAGE_KEY) === 'light'
          || localStorage.getItem(STORAGE_KEY) === 'dark';
      } catch {
        // If storage is unavailable, continue following the system preference.
      }
      hasExplicitChoice ||= savedCookieTheme() !== null;
      if (!hasExplicitChoice) {
        const nextTheme = event.matches ? 'dark' : 'light';
        applyTheme(nextTheme);
      }
  };

  media?.addEventListener('change', syncSystemTheme);
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  return () => {
    media?.removeEventListener('change', syncSystemTheme);
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
  };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribeToThemeChange, getTheme, getServerTheme);

  const toggleTheme = useCallback(() => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
    try {
      localStorage.setItem(STORAGE_KEY, nextTheme);
    } catch {
      // The cookie also stores the preference when local storage is unavailable.
    }
    document.cookie = `${STORAGE_KEY}=${nextTheme}; path=/; max-age=31536000; samesite=lax`;
  }, [theme]);

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
