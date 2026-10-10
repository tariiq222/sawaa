import React from 'react';
import { Alert, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

import { authService } from '@/services/auth';
import { DeleteAccountButton } from './DeleteAccountButton';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }));
jest.mock('@/hooks/useA11y', () => ({ useReduceMotion: () => false }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/services/auth', () => ({ authService: { requestAccountDeletion: jest.fn() } }));
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ theme: require('@/theme/tokens').buildTheme(null, mockScheme), scheme: mockScheme, isRTL: true, language: 'ar' }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ locale: 'ar', isRTL: true, row: 'row-reverse', textAlign: 'right', writingDirection: 'rtl' }) }));
jest.mock('@/theme/components/Glass', () => ({ Glass: require('react-native').View }));

let mockScheme: 'light' | 'dark' = 'light';
const requestClosure = authService.requestAccountDeletion as jest.Mock;
// The mocked `t` returns keys, so the confirmation word is the key itself.
const PHRASE = 'profile.deleteAccountPhrase';

beforeEach(() => {
  jest.clearAllMocks();
  mockScheme = 'light';
});

function openSheet() {
  const screen = render(<DeleteAccountButton />);
  fireEvent.press(screen.getByLabelText('profile.deleteAccount'));
  return screen;
}

function typePhrase(screen: ReturnType<typeof render>, value = PHRASE) {
  fireEvent.changeText(screen.getByLabelText('profile.deleteAccountPhraseLabel'), value);
}

const confirmButton = (screen: ReturnType<typeof render>) => screen.getByRole('button', { name: 'profile.deleteAccountAction' });

describe('DeleteAccountButton', () => {
  it('opens a sheet that lists every consequence before anything is sent', () => {
    const screen = openSheet();
    expect(screen.getByText('profile.deleteAccountSheetTitle')).toBeTruthy();
    expect(screen.getByText('profile.deleteAccountBody')).toBeTruthy();
    for (const point of ['profile.deleteAccountPointSignIn', 'profile.deleteAccountPointContact', 'profile.deleteAccountPointRecords']) {
      expect(screen.getByText(point)).toBeTruthy();
    }
    expect(requestClosure).not.toHaveBeenCalled();
  });

  it('keeps delete disabled until the confirmation word is typed exactly', async () => {
    const screen = openSheet();
    expect(confirmButton(screen).props.accessibilityState.disabled).toBe(true);
    fireEvent.press(confirmButton(screen));
    expect(requestClosure).not.toHaveBeenCalled();

    typePhrase(screen, 'wrong');
    expect(confirmButton(screen).props.accessibilityState.disabled).toBe(true);

    typePhrase(screen);
    expect(confirmButton(screen).props.accessibilityState.disabled).toBe(false);
    requestClosure.mockResolvedValueOnce(undefined);
    await act(async () => { fireEvent.press(confirmButton(screen)); });
    expect(requestClosure).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith('/(guest)/home');
  });

  it('cancels without calling the closure API and clears the typed word', () => {
    const screen = openSheet();
    typePhrase(screen);
    fireEvent.press(screen.getByRole('button', { name: 'profile.deleteAccountCancel' }));
    expect(requestClosure).not.toHaveBeenCalled();
    expect(screen.queryByText('profile.deleteAccountSheetTitle')).toBeNull();

    fireEvent.press(screen.getByLabelText('profile.deleteAccount'));
    expect(confirmButton(screen).props.accessibilityState.disabled).toBe(true);
  });

  it('shows an error and keeps the account when closure fails', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    requestClosure.mockRejectedValueOnce(new Error('network failure'));
    const screen = openSheet();
    typePhrase(screen);

    await act(async () => { fireEvent.press(confirmButton(screen)); });

    expect(requestClosure).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenLastCalledWith('profile.deleteAccountTitle', 'profile.deleteAccountError');
    expect(mockReplace).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('submits once when the confirm control fires twice', async () => {
    let resolveClosure: (() => void) | undefined;
    requestClosure.mockReturnValueOnce(new Promise<void>((resolve) => { resolveClosure = resolve; }));
    const screen = openSheet();
    typePhrase(screen);

    const confirm = confirmButton(screen);
    act(() => {
      fireEvent.press(confirm);
      fireEvent.press(confirm);
    });
    expect(requestClosure).toHaveBeenCalledTimes(1);

    await act(async () => { resolveClosure?.(); });
  });

  it('closes on backdrop without requesting deletion', () => {
    const view = openSheet();
    fireEvent.press(view.getByTestId('confirm-sheet-backdrop', { includeHiddenElements: true }));
    expect(view.queryByText('profile.deleteAccountSheetTitle')).toBeNull();
    expect(requestClosure).not.toHaveBeenCalled();
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
  const labelColor = StyleSheet.flatten(screen.getByText('profile.deleteAccountAction').props.style).color;
  const fill = confirmButton(screen).findAllByType(View)
    .map((node: { props: { style?: StyleProp<ViewStyle> } }) => StyleSheet.flatten(node.props.style)?.backgroundColor)
    .find((color: unknown): color is string => typeof color === 'string');
  expect(fill).toBeDefined();
  expect(contrast(labelColor, fill as string)).toBeGreaterThanOrEqual(4.5);
});
