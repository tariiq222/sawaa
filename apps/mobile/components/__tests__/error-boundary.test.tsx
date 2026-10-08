import React from 'react';
import { Appearance } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';
import i18n from '@/i18n';
import { ErrorBoundary } from '../error-boundary';
import { buildTheme } from '@/theme/tokens';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@sentry/react-native', () => ({ captureException: jest.fn() }));
// The failed provider must never be needed to render the fallback.
jest.mock('@/theme/useTheme', () => ({ useTheme: () => { throw new Error('Theme provider unavailable'); } }));
function BrokenProvider(): React.ReactNode { throw new Error('private provider exception'); }
let consoleError: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  jest.spyOn(Appearance, 'getColorScheme').mockReturnValue('light');
  jest.mocked(AsyncStorage.getItem).mockResolvedValue('dark');
});
afterEach(() => { consoleError.mockRestore(); jest.restoreAllMocks(); });

it.each(['ar', 'en'] as const)('renders a safe localized dark fallback when a provider fails (%s)', async (language) => {
  const screen = render(<ErrorBoundary language={language}><BrokenProvider /></ErrorBoundary>);
  expect(screen.getByText(i18n.t('common.error', { lng: language }))).toBeTruthy();
  expect(screen.getByText(i18n.t('common.errorDescription', { lng: language }))).toBeTruthy();
  expect(screen.queryByText('private provider exception')).toBeNull();
  await waitFor(() => expect(screen.getByTestId('app-error-fallback')).toHaveStyle({ backgroundColor: buildTheme(null, 'dark').colors.background }));
  expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ extra: expect.any(Object) }));
});

it('retries the child subtree and uses current system appearance when no mode is saved', async () => {
  jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
  const screen = render(<ErrorBoundary language="en"><BrokenProvider /></ErrorBoundary>);
  await waitFor(() => expect(AsyncStorage.getItem).toHaveBeenCalled());
  expect(screen.getByTestId('app-error-fallback')).toHaveStyle({ backgroundColor: buildTheme().colors.background });
  const reports = jest.mocked(Sentry.captureException).mock.calls.length;
  fireEvent.press(screen.getByRole('button', { name: i18n.t('common.tryAgain', { lng: 'en' }) }));
  expect(Sentry.captureException).toHaveBeenCalledTimes(reports + 1);
});
