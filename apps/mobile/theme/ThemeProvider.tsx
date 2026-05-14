import React, { createContext, useContext, useEffect, useMemo, ReactNode } from 'react';
import { I18nManager } from 'react-native';
import { buildTheme, type AppTheme } from './tokens';
import { useBranding } from '@/hooks/queries/useBranding';

interface ThemeContextValue {
  theme: AppTheme;
  isRTL: boolean;
  language: 'ar' | 'en';
}

const defaultTheme = buildTheme();

const ThemeContext = createContext<ThemeContextValue>({
  theme: defaultTheme,
  isRTL: true,
  language: 'ar',
});

interface ThemeProviderProps {
  children: ReactNode;
  language?: 'ar' | 'en';
}

export function ThemeProvider({ children, language = 'ar' }: ThemeProviderProps) {
  const isRTL = language === 'ar';
  const { data: branding } = useBranding();

  const theme = useMemo(() => buildTheme(branding ?? null), [branding]);

  useEffect(() => {
    if (I18nManager.isRTL !== isRTL) {
      I18nManager.forceRTL(isRTL);
    }
  }, [isRTL]);

  return (
    <ThemeContext.Provider value={{ theme, isRTL, language }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
