import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

import { authService } from '@/services/auth';
import { DeleteAccountButton } from './DeleteAccountButton';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/services/auth', () => ({ authService: { requestAccountDeletion: jest.fn() } }));
jest.mock('@/theme/sawaa', () => ({ sawaaColors: { accent: { coral: '#f00' } } }));
jest.mock('@/theme/components/ThemedText', () => ({ ThemedText: require('react-native').Text }));

const requestClosure = authService.requestAccountDeletion as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

function confirmationButtons(alertSpy: jest.SpyInstance) {
  const buttons = alertSpy.mock.calls[0]?.[2];
  if (!buttons) throw new Error('Confirmation alert was not shown');
  return buttons;
}

describe('DeleteAccountButton', () => {
  it('cancels without calling the closure API', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const screen = render(<DeleteAccountButton />);

    fireEvent.press(screen.getByRole('button'));
    const buttons = confirmationButtons(alertSpy);
    expect(buttons[0].style).toBe('cancel');
    act(() => buttons[0].onPress?.());
    expect(requestClosure).not.toHaveBeenCalled();
  });

  it('shows an error and keeps the button available when closure fails', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    requestClosure.mockRejectedValueOnce(new Error('network failure'));
    const screen = render(<DeleteAccountButton />);

    fireEvent.press(screen.getByRole('button'));
    const buttons = confirmationButtons(alertSpy);
    await act(async () => { buttons[1].onPress?.(); });

    expect(requestClosure).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenLastCalledWith('profile.deleteAccountTitle', 'profile.deleteAccountError');
    expect(screen.getByRole('button').props.accessibilityState.disabled).toBe(false);
  });

  it('submits once when the confirm callback fires twice', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    let resolveClosure: (() => void) | undefined;
    requestClosure.mockReturnValueOnce(new Promise<void>((resolve) => { resolveClosure = resolve; }));
    const screen = render(<DeleteAccountButton />);

    fireEvent.press(screen.getByRole('button'));
    const buttons = confirmationButtons(alertSpy);
    act(() => {
      buttons[1].onPress?.();
      buttons[1].onPress?.();
    });
    expect(requestClosure).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button').props.accessibilityState.disabled).toBe(true);

    await act(async () => { resolveClosure?.(); });
    expect(screen.getByRole('button').props.accessibilityState.disabled).toBe(false);
  });
});
