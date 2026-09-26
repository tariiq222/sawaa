import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockBooking: string | undefined;
jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: mockReplace,
    back: mockBack,
  }),
  useLocalSearchParams: () => ({
    identifier: 'test@example.com',
    maskedIdentifier: 't***@example.com',
    purpose: 'login',
    booking: mockBooking,
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
        primary: '#098a7d',
        primaryFill: '#087a6f',
        primaryGradient: ['#087a6f', '#066962'],
        primaryForeground: '#FFFFFF',
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
    mockBooking = undefined;
  });

  it('uses one four-character input for native SMS autofill', () => {
    const { getByLabelText } = render(<OtpVerifyScreen />);
    const input = getByLabelText('auth.otp.code');
    expect(input.props.textContentType).toBe('oneTimeCode');
    expect(input.props.autoComplete).toBe('sms-otp');
    expect(input.props.keyboardType).toBe('number-pad');
    expect(input.props.maxLength).toBe(4);
  });

  it('renders translated copy rather than untranslated keys', () => {
    const { getByText, queryByText } = render(<OtpVerifyScreen />);
    expect(getByText('auth.otp.title')).toBeTruthy();
    expect(queryByText('otp.title')).toBeNull();
  });

  it('exposes the icon-only back control as a labeled button', () => {
    const { getByRole } = render(<OtpVerifyScreen />);

    fireEvent.press(getByRole('button', { name: 'a11y.buttonBack' }));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('auto-submits when all 4 digits are filled', async () => {
    const { getByLabelText } = render(<OtpVerifyScreen />);
    const input = getByLabelText('auth.otp.code');
    fireEvent.changeText(input, '123');
    expect(mockVerifyOtp).not.toHaveBeenCalled();
    fireEvent.changeText(input, '1234');

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

    fireEvent.changeText(getByLabelText('auth.otp.code'), '6543');

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

  it('returns a verified client to the selected appointment payment step', async () => {
    mockBooking = JSON.stringify({
      serviceId: 'service-1', employeeId: 'employee-1', branchId: 'branch-1',
      deliveryType: 'online', scheduledAt: '2026-10-01T10:00:00.000Z',
      durationOptionId: 'duration-1', amount: '45000', currency: 'SAR',
    });
    mockVerifyOtp.mockResolvedValueOnce({
      tokens: { accessToken: 'access-token', refreshToken: 'refresh-token' },
      sessionEpoch: 1, sessionKind: 'client',
    });
    const { getByLabelText } = render(<OtpVerifyScreen />);
    fireEvent.changeText(getByLabelText('auth.otp.code'), '1234');
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/(client)/booking/payment',
      params: {
        serviceId: 'service-1', employeeId: 'employee-1', branchId: 'branch-1',
        deliveryType: 'online', scheduledAt: '2026-10-01T10:00:00.000Z',
        durationOptionId: 'duration-1', amount: '45000', currency: 'SAR',
      },
    }));
  });

  it('filters non-digits and never submits an incomplete code', async () => {
    const { getByLabelText } = render(<OtpVerifyScreen />);
    const input = getByLabelText('auth.otp.code');
    fireEvent.changeText(input, '12a');
    expect(input.props.value).toBe('12');
    expect(mockVerifyOtp).not.toHaveBeenCalled();
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
    fireEvent.changeText(getByLabelText('auth.otp.code'), '1234');
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(employee)/(tabs)/today'));
    expect(mockGetProfile).toHaveBeenCalledWith('staff');
  });

  it('waits for the direct profile before committing auth or navigating', async () => {
    let resolveProfile!: (value: unknown) => void;
    mockGetProfile.mockReturnValueOnce(new Promise((resolve) => {
      resolveProfile = resolve;
    }));
    const { getByLabelText } = render(<OtpVerifyScreen />);
    fireEvent.changeText(getByLabelText('auth.otp.code'), '1234');

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
    fireEvent.changeText(getByLabelText('auth.otp.code'), '1234');

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

    fireEvent.changeText(getByLabelText('auth.otp.code'), '6543');

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
