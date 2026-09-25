import React from 'react';
import { act, render } from '@testing-library/react-native';

const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: mockBack }),
  useLocalSearchParams: () => ({
    identifier: 'test@example.com',
    maskedIdentifier: 't***@example.com',
    purpose: 'register',
  }),
}));

const mockDispatch = jest.fn();
jest.mock('@/hooks/use-redux', () => ({ useAppDispatch: () => mockDispatch }));
jest.mock('@/hooks/queries', () => ({
  useVerifyOtp: () => ({ mutateAsync: jest.fn() }),
  useRequestLoginOtp: () => ({ mutateAsync: jest.fn() }),
}));
jest.mock('@/services/auth', () => ({
  authService: { getProfile: jest.fn() },
  SessionSupersededError: class SessionSupersededError extends Error {},
}));
jest.mock('@/services/native-session-state', () => ({ isSessionCurrent: () => true }));
jest.mock('@/stores/slices/auth-slice', () => ({ setCredentials: jest.fn() }));
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(), impactAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
  ImpactFeedbackStyle: { Light: 'light' },
}));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    theme: { colors: { surface: '#fff', surfaceHigh: '#eee', textPrimary: '#000', textSecondary: '#666', textMuted: '#999' }, typography: { fontFamily: { arabic: 'System', english: 'System' } } },
    isRTL: false,
  }),
}));

import i18n from '@/i18n';
import OtpVerifyScreen from '../otp-verify';

describe('OtpVerifyScreen translations', () => {
  afterEach(async () => { await act(async () => { await i18n.changeLanguage('ar'); }); });

  it.each([
    ['ar', 'رمز التحقق', 'الرمز المرسل إلى', 'تحقق', 'اضغط رجوع وأعد الإرسال إذا لم تستلم الرمز'],
    ['en', 'Verification Code', 'Code sent to', 'Verify', "Go back and re-submit if you didn't receive the code."],
  ])('renders translated OTP labels in %s', async (language, title, sentTo, submit, noResend) => {
    await act(async () => { await i18n.changeLanguage(language as string); });
    const { getByText } = render(<OtpVerifyScreen />);

    expect(getByText(title as string)).toBeTruthy();
    expect(getByText(`${sentTo} t***@example.com`)).toBeTruthy();
    expect(getByText(submit as string)).toBeTruthy();
    expect(getByText(noResend as string)).toBeTruthy();
  });
});
