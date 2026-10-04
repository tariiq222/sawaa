import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, back: jest.fn() }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/theme/sawaa', () => ({ AquaBackground: require('react-native').View }));
jest.mock('@/theme/sawaa/useSawaaColors', () => ({
  useSawaaColors: () => jest.requireActual('@/theme/sawaa/tokens').getSawaaColors('light'),
}));
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ scheme: 'light', language: 'ar', isRTL: true }) }));
const mockLogout = jest.fn();
jest.mock('@/services/auth', () => ({ authService: { logout: () => mockLogout() } }));

import SuspendedScreen from '../suspended';

describe('suspended screen escape route', () => {
  beforeEach(() => jest.clearAllMocks());

  it('labels the logout action honestly and returns to login', async () => {
    const screen = render(<SuspendedScreen />);
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'auth.logout' })); });
    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
  });

  it('lets the user keep browsing without a signed-in session', () => {
    const screen = render(<SuspendedScreen />);

    fireEvent.press(screen.getByLabelText('suspended.continueAsGuest'));

    expect(mockReplace).toHaveBeenCalledWith('/(guest)/home');
    expect(mockLogout).not.toHaveBeenCalled();
  });
});
