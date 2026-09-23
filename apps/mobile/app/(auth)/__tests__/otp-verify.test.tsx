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
const mockSetCredentials = jest.fn((payload: unknown) => ({ type: 'auth/setCredentials', payload }));
jest.mock('@/stores/slices/auth-slice', () => ({
  setAuthSession: (payload: unknown) => mockSetAuthSession(payload),
  setUser: (payload: unknown) => mockSetUser(payload),
  setCredentials: (payload: unknown) => mockSetCredentials(payload),
}));

const mockVerifyOtp = jest.fn().mockResolvedValue({
  tokens: { accessToken: 'access-token', refreshToken: 'refresh-token' },
  sessionEpoch: 1,
});
const mockRequestLoginOtp = jest.fn().mockResolvedValue({ maskedIdentifier: 't***@example.com' });
const mockGetProfile = jest.fn().mockResolvedValue({
  success: true,
  data: { id: 'u1', role: 'CLIENT' },
});
jest.mock('@/hooks/queries', () => ({
  useVerifyOtp: () => ({ mutateAsync: mockVerifyOtp }),
  useRequestLoginOtp: () => ({ mutateAsync: mockRequestLoginOtp }),
}));

jest.mock('@/services/push', () => ({
  registerForPushAsync: jest.fn(),
}));

let mockCurrentEpoch = 1;
const mockIsSessionCurrent = jest.fn((epoch: number) => epoch === mockCurrentEpoch);
jest.mock('@/services/native-session-state', () => ({
  isSessionCurrent: (epoch: number) => mockIsSessionCurrent(epoch),
}));
jest.mock('@/services/auth', () => ({
  authService: {
    getProfile: (kind?: 'client' | 'staff') => mockGetProfile(kind),
  },
  SessionSupersededError: class SessionSupersededError extends Error {},
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
    mockCurrentEpoch = 1;
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

  it('exposes the icon-only back control as a labeled button', () => {
    const { getByRole } = render(<OtpVerifyScreen />);

    fireEvent.press(getByRole('button', { name: 'a11y.buttonBack' }));

    expect(mockBack).toHaveBeenCalledTimes(1);
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

  it('routes a verified staff session to employee tabs after the profile is loaded', async () => {
    mockVerifyOtp.mockResolvedValueOnce({
      tokens: { accessToken: 'staff-access', refreshToken: 'staff-refresh' },
      sessionEpoch: 1,
      sessionKind: 'staff',
    });
    mockGetProfile.mockResolvedValueOnce({
      success: true,
      data: { id: 'u1', role: 'RECEPTIONIST' },
    });
    const { getByLabelText } = render(<OtpVerifyScreen />);
    fireEvent.changeText(getByLabelText('OTP digit 1 of 4'), '1234');
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(employee)/(tabs)/today'));
    expect(mockGetProfile).toHaveBeenCalledWith('staff');
  });

  it('waits for the direct profile before committing auth or navigating', async () => {
    let resolveProfile!: (value: unknown) => void;
    mockGetProfile.mockReturnValueOnce(new Promise((resolve) => {
      resolveProfile = resolve;
    }));
    const { getByLabelText } = render(<OtpVerifyScreen />);
    fireEvent.changeText(getByLabelText('OTP digit 1 of 4'), '1234');

    await waitFor(() => expect(mockGetProfile).toHaveBeenCalled());
    expect(mockDispatch).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();

    resolveProfile({ success: true, data: { id: 'u1', role: 'CLIENT' } });
    await waitFor(() => expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({
        user: expect.objectContaining({ id: 'u1' }),
      }),
    })));
    expect(mockReplace).toHaveBeenCalledWith('/(client)/(tabs)/home');
  });

  it('does not commit auth or navigate when the profile fetch fails', async () => {
    mockGetProfile.mockResolvedValueOnce({ success: false, data: undefined });
    const { getByLabelText } = render(<OtpVerifyScreen />);
    fireEvent.changeText(getByLabelText('OTP digit 1 of 4'), '1234');

    await waitFor(() => expect(mockGetProfile).toHaveBeenCalled());
    expect(mockDispatch).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('does not dispatch or navigate when successful verification is superseded', async () => {
    mockCurrentEpoch = 2;
    mockVerifyOtp.mockResolvedValueOnce({
      tokens: { accessToken: 'stale-access', refreshToken: 'stale-refresh' },
      sessionEpoch: 1,
    });
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
      expect(mockDispatch).not.toHaveBeenCalled();
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });
});
