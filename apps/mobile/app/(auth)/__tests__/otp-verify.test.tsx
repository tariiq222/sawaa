import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: mockReplace,
    back: mockBack,
  }),
  useLocalSearchParams: () => ({
    identifier: 'test@example.com',
    maskedIdentifier: 't***@example.com',
    purpose: 'login',
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { index?: number; total?: number }) => {
      if (key === 'auth.otpBoxLabel') {
        return `OTP digit ${options?.index} of ${options?.total}`;
      }
      return key;
    },
  }),
}));

const mockDispatch = jest.fn();
jest.mock('@/hooks/use-redux', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: jest.fn(),
}));

const mockSetAuthSession = jest.fn((payload: unknown) => ({ type: 'auth/setAuthSession', payload }));
const mockSetUser = jest.fn((payload: unknown) => ({ type: 'auth/setUser', payload }));
jest.mock('@/stores/slices/auth-slice', () => ({
  setAuthSession: (payload: unknown) => mockSetAuthSession(payload),
  setUser: (payload: unknown) => mockSetUser(payload),
}));

const mockVerifyOtp = jest.fn().mockResolvedValue({
  tokens: { accessToken: 'access-token', refreshToken: 'refresh-token' },
  activeMembership: null,
});
const mockRequestLoginOtp = jest.fn().mockResolvedValue({ maskedIdentifier: 't***@example.com' });
const mockRefetchMe = jest.fn().mockResolvedValue({ data: { data: { id: 'u1', role: 'CLIENT' } } });
jest.mock('@/hooks/queries', () => ({
  useVerifyOtp: () => ({ mutateAsync: mockVerifyOtp }),
  useRequestLoginOtp: () => ({ mutateAsync: mockRequestLoginOtp }),
  useMe: () => ({ refetch: mockRefetchMe }),
}));

jest.mock('@/services/push', () => ({
  registerForPushAsync: jest.fn(),
}));

jest.mock('@/services/tenant', () => ({
  setCurrentOrgId: jest.fn(),
}));

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  impactAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
  ImpactFeedbackStyle: { Light: 'light' },
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        surface: '#FFF',
        surfaceHigh: '#EEE',
        textPrimary: '#000',
        textSecondary: '#666',
        textMuted: '#999',
      },
      typography: {
        fontFamily: {
          arabic: 'System',
          english: 'System',
        },
      },
    },
    isRTL: false,
    language: 'en',
  }),
}));

import OtpVerifyScreen from '../otp-verify';

describe('OtpVerifyScreen Autofill & Auto-submit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders 4 OTP input boxes with SMS autofill attributes', () => {
    const { getByLabelText } = render(<OtpVerifyScreen />);

    for (let i = 1; i <= 4; i += 1) {
      const input = getByLabelText(`OTP digit ${i} of 4`);
      expect(input.props.textContentType).toBe('oneTimeCode');
      expect(input.props.autoComplete).toBe('sms-otp');
      expect(input.props.keyboardType).toBe('number-pad');
    }
  });

  it('auto-submits when all 4 digits are filled', async () => {
    const { getByLabelText } = render(<OtpVerifyScreen />);

    for (let i = 1; i <= 3; i += 1) {
      fireEvent.changeText(getByLabelText(`OTP digit ${i} of 4`), i.toString());
    }

    expect(mockVerifyOtp).not.toHaveBeenCalled();

    fireEvent.changeText(getByLabelText('OTP digit 4 of 4'), '4');

    await waitFor(() => {
      expect(mockVerifyOtp).toHaveBeenCalledWith({
        identifier: 'test@example.com',
        code: '1234',
        purpose: 'login',
      });
    });
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(client)/(tabs)/home');
    });
  });

  it('handles paste and auto-submits', async () => {
    const { getByLabelText } = render(<OtpVerifyScreen />);

    fireEvent.changeText(getByLabelText('OTP digit 1 of 4'), '6543');

    await waitFor(() => {
      expect(mockVerifyOtp).toHaveBeenCalledWith({
        identifier: 'test@example.com',
        code: '6543',
        purpose: 'login',
      });
    });
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(client)/(tabs)/home');
    });
  });
});
