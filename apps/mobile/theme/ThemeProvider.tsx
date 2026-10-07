import React, { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef, ReactNode } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildTheme, type AppTheme } from './tokens';
import { useBranding } from '@/hooks/queries/useBranding';

import { THEME_MODE_KEY, type ThemeMode } from './preferences';
export type { ThemeMode } from './preferences';

interface ThemeContextValue {
  theme: AppTheme;
  isRTL: boolean;
  language: 'ar' | 'en';
  scheme: 'light' | 'dark';
  mode: ThemeMode;
  setThemeMode: (next: ThemeMode) => void;
}

const defaultTheme = buildTheme();

const ThemeContext = createContext<ThemeContextValue>({
  theme: defaultTheme,
  isRTL: true,
  language: 'ar',
  scheme: 'light',
  mode: 'system',
  setThemeMode: () => {},
});

interface ThemeProviderProps {
  children: ReactNode;
  language?: 'ar' | 'en';
}

export function ThemeProvider({ children, language = 'ar' }: ThemeProviderProps) {
  const isRTL = language === 'ar';
  const { data: branding } = useBranding();

  const systemScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>('system');

  const userSelectedMode = useRef(false);
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(THEME_MODE_KEY).then((v) => {
      if (active && !userSelectedMode.current && (v === 'light' || v === 'dark' || v === 'system')) setMode(v);
    }).catch(() => { /* Keep system appearance if local storage is unavailable. */ });
    return () => { active = false; };
  }, []);

  const scheme: 'light' | 'dark' =
    mode === 'system'
      ? systemScheme === 'dark'
        ? 'dark'
        : 'light'
      : mode;

  const setThemeMode = useCallback((next: ThemeMode) => {
    userSelectedMode.current = true;
    setMode(next);
    void AsyncStorage.setItem(THEME_MODE_KEY, next).catch(() => { /* The in-session selection still applies. */ });
  }, []);

  const theme = useMemo(() => buildTheme(branding ?? null, scheme), [branding, scheme]);

  useEffect(() => {
    Appearance.setColorScheme(mode === 'system' ? 'unspecified' : scheme);
    return () => Appearance.setColorScheme('unspecified');
  }, [mode, scheme]);

  return (
    <ThemeContext.Provider value={{ theme, isRTL, language, scheme, mode, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
