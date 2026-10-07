import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

import { authService } from '@/services/auth';
import { DeleteAccountButton } from './DeleteAccountButton';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/services/auth', () => ({ authService: { requestAccountDeletion: jest.fn() } }));
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ theme: require('@/theme/tokens').buildTheme(null, mockScheme), scheme: mockScheme, isRTL: true, language: 'ar' }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ locale: 'ar', isRTL: true, row: 'row-reverse', writingDirection: 'rtl' }) }));

let mockScheme: 'light' | 'dark' = 'light';
const requestClosure = authService.requestAccountDeletion as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockScheme = 'light';
});

function openSheet() {
  const screen = render(<DeleteAccountButton />);
  fireEvent.press(screen.getByLabelText('profile.deleteAccount'));
  return screen;
}

describe('DeleteAccountButton', () => {
  it('shows a confirmation sheet first and cancels without calling the closure API', () => {
    const screen = openSheet();
    expect(screen.getByText('profile.deleteAccountSheetTitle')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('profile.deleteAccountCancel'));
    expect(requestClosure).not.toHaveBeenCalled();
    expect(screen.queryByText('profile.deleteAccountSheetTitle')).toBeNull();
  });

  it('shows an error and keeps the button available when closure fails', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    requestClosure.mockRejectedValueOnce(new Error('network failure'));
    const screen = openSheet();

    await act(async () => { fireEvent.press(screen.getByLabelText('profile.deleteAccountAction')); });

    expect(requestClosure).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenLastCalledWith('profile.deleteAccountTitle', 'profile.deleteAccountError');
    expect(screen.getByLabelText('profile.deleteAccount').props.accessibilityState.disabled).toBe(false);
  });

  it('submits once when the confirm control fires twice', async () => {
    let resolveClosure: (() => void) | undefined;
    requestClosure.mockReturnValueOnce(new Promise<void>((resolve) => { resolveClosure = resolve; }));
    const screen = openSheet();

    const confirm = screen.getByLabelText('profile.deleteAccountAction');
    act(() => {
      fireEvent.press(confirm);
      fireEvent.press(confirm);
    });
    expect(requestClosure).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('profile.deleteAccount').props.accessibilityState.disabled).toBe(true);

    await act(async () => { resolveClosure?.(); });
    expect(screen.getByLabelText('profile.deleteAccount').props.accessibilityState.disabled).toBe(false);
  });
});

function contrast(first: string, second: string) {
  const luminance = (hex: string) => {
    const rgb = hex.slice(1).match(/.{2}/g)!.map((channel) => {
      const value = parseInt(channel, 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  };
  const [high, low] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (high + 0.05) / (low + 0.05);
}

it.each(['light', 'dark'] as const)('keeps destructive labels readable in %s appearance', (scheme) => {
  mockScheme = scheme;
  const screen = openSheet();
  const { StyleSheet } = require('react-native');
  const labelColor = StyleSheet.flatten(screen.getByText('profile.deleteAccountAction').props.style).color;
  const fill = StyleSheet.flatten(screen.getByLabelText('profile.deleteAccountAction').props.style).backgroundColor;
  expect(contrast(labelColor, fill)).toBeGreaterThanOrEqual(4.5);
});
