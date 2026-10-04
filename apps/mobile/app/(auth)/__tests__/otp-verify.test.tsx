import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';

const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockBooking: string | undefined;
let mockRedirect: string | undefined;
jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: mockReplace,
    back: mockBack,
  }),
  useLocalSearchParams: () => ({
    ...mockParams,
    booking: mockBooking,
    redirect: mockRedirect,
  }),
}));

const loginParams = {
  identifier: 'test@example.com',
  maskedIdentifier: 't***@example.com',
  purpose: 'login',
};
const registerParams = {
  identifier: '0501234567',
  maskedIdentifier: '+966***67',
  purpose: 'register',
  firstName: 'Sara',
  lastName: 'Ahmad',
  email: 'sara@example.com',
};
let mockParams: Record<string, string> = loginParams;

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { index?: number; total?: number; seconds?: number }) => {
      if (key === 'auth.otpBoxLabel') {
        return `OTP digit ${options?.index} of ${options?.total}`;
      }
      if (key === 'auth.otp.resendIn') {
        return `auth.otp.resendIn ${options?.seconds}`;
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
const mockRegister = jest.fn().mockResolvedValue({ userId: 'u1', maskedPhone: '+966***67' });
const mockGetProfile = jest.fn().mockResolvedValue({
  success: true,
  data: { id: 'u1', role: 'CLIENT' },
});
jest.mock('@/hooks/queries', () => ({
  useVerifyOtp: () => ({ mutateAsync: mockVerifyOtp }),
  useRequestLoginOtp: () => ({ mutateAsync: mockRequestLoginOtp }),
  useRegister: () => ({ mutateAsync: mockRegister }),
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
    mockRedirect = undefined;
    mockParams = loginParams;
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

  it('returns a verified client to confirmation with the selected practitioner price', async () => {
    mockRedirect = '/(client)/(tabs)/appointments';
    mockBooking = JSON.stringify({
      clinicId: 'clinic-1', serviceId: 'service-1', employeeId: 'employee-1', branchId: 'branch-1',
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
      pathname: '/(client)/booking/confirm',
      params: {
        clinicId: 'clinic-1',
        serviceId: 'service-1', employeeId: 'employee-1', branchId: 'branch-1',
        deliveryType: 'online', scheduledAt: '2026-10-01T10:00:00.000Z',
        durationOptionId: 'duration-1', chargedPrice: '45000', currency: 'SAR',
      },
    }));
  });

  it('resumes a guarded client route after OTP when there is no booking draft', async () => {
    mockRedirect = '/(client)/booking/confirm?clinicId=clinic-1&serviceId=service-1&employeeId=employee-1';
    mockVerifyOtp.mockResolvedValueOnce({
      tokens: { accessToken: 'access-token', refreshToken: 'refresh-token' },
      sessionEpoch: 1, sessionKind: 'client',
    });
    const { getByLabelText } = render(<OtpVerifyScreen />);
    fireEvent.changeText(getByLabelText('auth.otp.code'), '1234');

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/(client)/booking/confirm',
      params: { clinicId: 'clinic-1', serviceId: 'service-1', employeeId: 'employee-1' },
    }));
  });

  it('resumes a guarded employee route for a verified staff session', async () => {
    mockRedirect = '/(employee)/client/client-9';
    mockVerifyOtp.mockResolvedValueOnce({
      tokens: { accessToken: 'staff-access', refreshToken: 'staff-refresh' },
      sessionEpoch: 1, sessionKind: 'staff',
    });
    mockGetProfile.mockResolvedValueOnce({ success: true, data: { id: 'staff-1', role: 'RECEPTIONIST' } });
    const { getByLabelText } = render(<OtpVerifyScreen />);
    fireEvent.changeText(getByLabelText('auth.otp.code'), '1234');

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(employee)/client/client-9'));
  });

  it('rejects an employee route redirect for a verified client session', async () => {
    mockRedirect = '/(employee)/client/client-9';
    mockVerifyOtp.mockResolvedValueOnce({
      tokens: { accessToken: 'access-token', refreshToken: 'refresh-token' },
      sessionEpoch: 1, sessionKind: 'client',
    });
    const { getByLabelText } = render(<OtpVerifyScreen />);
    fireEvent.changeText(getByLabelText('auth.otp.code'), '1234');

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(client)/(tabs)/home'));
  });

  it('resumes the protected route a guard handed to login', async () => {
    mockRedirect = '/(client)/video-call?bookingId=booking-9';
    const { getByLabelText } = render(<OtpVerifyScreen />);
    fireEvent.changeText(getByLabelText('auth.otp.code'), '1234');

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/(client)/video-call',
      params: { bookingId: 'booking-9' },
    }));
  });

  it('ignores a redirect target that leaves the app or re-enters auth', async () => {
    mockRedirect = 'https://evil.example/steal';
    const { getByLabelText } = render(<OtpVerifyScreen />);
    fireEvent.changeText(getByLabelText('auth.otp.code'), '1234');

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(client)/(tabs)/home'));
  });

  it('keeps an in-progress booking ahead of the guarded redirect', async () => {
    mockRedirect = '/(client)/(tabs)/appointments';
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

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/(client)/booking/confirm' }),
    ));
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

describe('OtpVerifyScreen resend', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockCurrentEpoch = 1;
    mockBooking = undefined;
    mockRedirect = undefined;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function waitOutCooldown() {
    act(() => {
      jest.advanceTimersByTime(60_000);
    });
  }

  it('shows a cooldown on the register screen before resend is allowed', () => {
    mockParams = registerParams;
    const { getByText, queryByText } = render(<OtpVerifyScreen />);

    expect(getByText('auth.otp.resendIn 60')).toBeTruthy();
    expect(queryByText('auth.otp.resend')).toBeNull();
    expect(queryByText('auth.otp.registerNoResend')).toBeNull();
  });

  it('re-submits the same registration details to re-send the register code', async () => {
    mockParams = registerParams;
    const { getByText } = render(<OtpVerifyScreen />);

    waitOutCooldown();
    fireEvent.press(getByText('auth.otp.resend'));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        firstName: 'Sara',
        lastName: 'Ahmad',
        phone: '0501234567',
        email: 'sara@example.com',
      });
    });
    expect(mockRequestLoginOtp).not.toHaveBeenCalled();
    // Cooldown restarts after a successful resend.
    await waitFor(() => expect(getByText('auth.otp.resendIn 60')).toBeTruthy());
  });

  it('shows an error and keeps resend available when the register resend fails', async () => {
    mockParams = registerParams;
    mockRegister.mockRejectedValueOnce(new Error('429'));
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const { getByText } = render(<OtpVerifyScreen />);

    waitOutCooldown();
    fireEvent.press(getByText('auth.otp.resend'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('common.error', 'auth.error.generic'));
    expect(getByText('auth.otp.resend')).toBeTruthy();
    alertSpy.mockRestore();
  });

  it('uses the login OTP request on the login screen', async () => {
    mockParams = loginParams;
    const { getByText } = render(<OtpVerifyScreen />);

    waitOutCooldown();
    fireEvent.press(getByText('auth.otp.resend'));

    await waitFor(() => {
      expect(mockRequestLoginOtp).toHaveBeenCalledWith({ identifier: 'test@example.com' });
    });
    expect(mockRegister).not.toHaveBeenCalled();
  });
});
