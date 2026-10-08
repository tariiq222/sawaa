import React from 'react';
import { Linking } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

let mockVideoEnabled = true;
jest.mock('@/constants/feature-flags', () => ({ FEATURE_FLAGS: { get videoCalls() { return mockVideoEnabled; } } }));
jest.mock('@/theme/sawaa', () => jest.requireActual('@/theme/sawaa/tokens'));
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ theme: require('@/theme/tokens').buildTheme(null, 'light'), scheme: 'light' }) }));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, options?: import('i18next').TOptions) => require('@/test-utils/translation').translatedTestMessage(key, 'en', options) }) }));
import { JoinVideoCallButton } from '../features/JoinVideoCallButton';

const start = new Date('2026-10-07T12:00:00Z');
const props = { url: 'https://example.test/meeting', scheduledAt: start.toISOString(), durationMins: 60, status: 'CREATED' as const, isRTL: false, variant: 'join' as const };
beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date(start.getTime() - 16 * 60_000)); mockVideoEnabled = true; });
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

it('enables joining at the opening boundary without rerendering the parent', () => {
  const screen = render(<JoinVideoCallButton {...props} />);
  expect(screen.getByRole('button')).toBeDisabled();
  act(() => { jest.advanceTimersByTime(60_000); });
  expect(screen.getByRole('button')).toBeEnabled();
  expect(screen.getByText('Join session')).toBeTruthy();
});
it('disables joining just after the ending boundary', () => {
  jest.setSystemTime(start);
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  const screen = render(<JoinVideoCallButton {...props} />);
  expect(screen.getByRole('button')).toBeEnabled();
  act(() => { jest.advanceTimersByTime(60 * 60_000 + 1); });
  expect(screen.getByRole('button')).toBeDisabled();
  fireEvent.press(screen.getByRole('button'));
  expect(open).not.toHaveBeenCalled();
});
it('rejects malformed timing instead of opening a join window', () => {
  const screen = render(<JoinVideoCallButton {...props} scheduledAt="invalid" />);
  expect(screen.getByRole('button')).toBeDisabled();
});
it('keeps the disabled production feature hidden without scheduling a clock', () => {
  mockVideoEnabled = false;
  const screen = render(<JoinVideoCallButton {...props} />);
  expect(screen.toJSON()).toBeNull();
  expect(jest.getTimerCount()).toBe(0);
});
