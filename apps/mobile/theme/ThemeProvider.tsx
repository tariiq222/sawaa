import React, { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef, ReactNode } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildTheme, type AppTheme } from './tokens';
import { useBranding } from '@/hooks/queries/useBranding';

export type ThemeMode = 'system' | 'light' | 'dark';
const THEME_MODE_KEY = 'sawaa.themeMode';

interface ThemeContextValue {
  theme: AppTheme;
  isRTL: boolean;
  language: 'ar' | 'en';
  scheme: 'light' | 'dark';
  isHydrated: boolean;
  mode: ThemeMode;
  setThemeMode: (next: ThemeMode) => void;
}

const defaultTheme = buildTheme();

const ThemeContext = createContext<ThemeContextValue>({
  theme: defaultTheme,
  isRTL: true,
  language: 'ar',
  scheme: 'light',
  isHydrated: true,
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
  const [isHydrated, setIsHydrated] = useState(false);

  const userSelectedMode = useRef(false);
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(THEME_MODE_KEY).then((v) => {
      if (!active) return;
      if (!userSelectedMode.current && (v === 'light' || v === 'dark' || v === 'system')) setMode(v);
      setIsHydrated(true);
    }).catch(() => {
      // Keep system appearance if local storage is unavailable.
      if (active) setIsHydrated(true);
    });
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
    <ThemeContext.Provider value={{ theme, isRTL, language, scheme, isHydrated, mode, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
