import React, { createContext, useContext, useEffect, useMemo, useState, useCallback, ReactNode } from 'react';
import { I18nManager, useColorScheme } from 'react-native';
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

  useEffect(() => {
    AsyncStorage.getItem(THEME_MODE_KEY).then((v) => {
      if (v === 'light' || v === 'dark' || v === 'system') setMode(v);
    });
  }, []);

  const scheme: 'light' | 'dark' =
    mode === 'system'
      ? systemScheme === 'dark'
        ? 'dark'
        : 'light'
      : mode;

  const setThemeMode = useCallback((next: ThemeMode) => {
    setMode(next);
    void AsyncStorage.setItem(THEME_MODE_KEY, next);
  }, []);

  const theme = useMemo(() => buildTheme(branding ?? null, scheme), [branding, scheme]);

  useEffect(() => {
    if (I18nManager.isRTL !== isRTL) {
      I18nManager.forceRTL(isRTL);
    }
  }, [isRTL]);

  return (
    <ThemeContext.Provider value={{ theme, isRTL, language, scheme, mode, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
