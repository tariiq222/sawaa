import React from 'react';
import { render } from '@testing-library/react-native';
import { DirContext, buildDirState } from '@/hooks/useDir';
import { AboutSection } from './AboutSection';
jest.mock('expo-application', () => ({ nativeApplicationVersion: '3.0.0', nativeBuildVersion: '77' }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '2.0.0', ios: { buildNumber: '31' } } } }));
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ scheme: 'light', language: 'en', theme: require('@/theme/tokens').buildTheme() }) }));
jest.mock('@/theme/components/Glass', () => ({ Glass: require('react-native').View }));
let mockLocale = 'en';
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => {
  const labels: Record<string, string[]> = { 'settings.about': ['About', 'حول التطبيق'], 'settings.version': ['Version', 'الإصدار'], 'settings.buildNumber': ['Build number', 'رقم البناء'] };
  return labels[key]?.[mockLocale === 'ar' ? 1 : 0] ?? key;
} }) }));
it.each(['ar', 'en'] as const)('displays real native metadata in %s', locale => {
  mockLocale = locale;
  const view = render(<DirContext.Provider value={buildDirState(locale)}><AboutSection /></DirContext.Provider>);
  expect(view.getByText('3.0.0')).toBeTruthy();
  expect(view.getByText('77')).toBeTruthy();
  expect(view.getByRole('header')).toHaveTextContent(locale === 'ar' ? 'حول التطبيق' : 'About');
});
