import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

const mockReplace = jest.fn();
const mockPush = jest.fn();
let mockParams: { email?: string; identifier?: string; booking?: string; redirect?: string } = {};
const mockReset = jest.fn();
const mockVerify = jest.fn();
const mockRequest = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, push: mockPush, back: jest.fn() }), useLocalSearchParams: () => mockParams }));
jest.mock('@/services/auth', () => ({ authService: { requestPasswordResetOtp: (...args: unknown[]) => mockRequest(...args), verifyPasswordResetOtp: (...args: unknown[]) => mockVerify(...args), resetClientPassword: (...args: unknown[]) => mockReset(...args) } }));
jest.mock('expo-haptics', () => ({ notificationAsync: jest.fn(), impactAsync: jest.fn(), NotificationFeedbackType: { Success: 'success', Error: 'error' }, ImpactFeedbackStyle: { Light: 'light' } }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ scheme: 'light', theme: { colors: { surface: '#fff', surfaceHigh: '#eee', textPrimary: '#000', textSecondary: '#666', textMuted: '#999' }, typography: { fontFamily: { arabic: 'System', english: 'System' } } }, isRTL: false }) }));

jest.mock('@/theme', () => ({ Glass: require('@/theme/components/Glass').Glass }));
jest.mock('@/theme/ThemeProvider', () => require('@/theme/useTheme'));

import i18n from '@/i18n';
import ForgotPassword from '../forgot-password';
import ResetPassword from '../reset-password';

beforeEach(() => { jest.clearAllMocks(); mockParams = { email: 'test@example.com' }; mockVerify.mockResolvedValue({ sessionToken: 'session' }); });
afterEach(async () => { await act(async () => { await i18n.changeLanguage('ar'); }); });

it.each([
  ['ar', 'إنشاء أو استعادة كلمة المرور', 'إرسال الرمز', 'أدخل بريدًا إلكترونيًا أو رقم جوال صحيحًا'],
  ['en', 'Create or reset password', 'Send Code', 'Enter a valid email or phone number'],
])('translates recovery and invalid identifier in %s', async (locale, title, submit, error) => {
  await act(async () => { await i18n.changeLanguage(locale); });
  const screen = render(<ForgotPassword />);
  expect(screen.getByText(title)).toBeTruthy();
  await act(async () => { fireEvent.press(screen.getByText(submit)); });
  expect(screen.getByText(error)).toBeTruthy();
  expect(mockRequest).not.toHaveBeenCalled();
});

it.each([
  ['ar', 'أدخل رمز التحقق المكوّن من أربعة أرقام المرسل إلى test@example.com', 'تحقق من الرمز', 'رمز غير صالح أو منتهي الصلاحية'],
  ['en', 'Enter the 4-digit verification code sent to test@example.com', 'Verify Code', 'Invalid or expired code'],
])('interpolates the recipient and translates invalid reset code in %s', async (locale, subtitle, verify, error) => {
  await act(async () => { await i18n.changeLanguage(locale); });
  const screen = render(<ResetPassword />);
  expect(screen.getByText(subtitle)).toBeTruthy();
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: verify })); });
  expect(screen.getByText(error)).toBeTruthy();
  expect(mockVerify).not.toHaveBeenCalled();
});

it('shows an English server-failure alert and keeps the reset form available', async () => {
  await act(async () => { await i18n.changeLanguage('en'); });
  mockVerify.mockRejectedValue(new Error('offline'));
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const screen = render(<ResetPassword />);
  fireEvent.changeText(screen.getByPlaceholderText('1234'), '1234');
  fireEvent.press(screen.getByRole('button', { name: 'Verify Code' }));
  await waitFor(() => expect(alert).toHaveBeenCalledWith('An error occurred', 'Invalid or expired code'));
  expect(screen.getByRole('button', { name: 'Verify Code' })).toBeTruthy();
  alert.mockRestore();
});

it.each([
  ['ar', 'تحقق من الرمز', 'كلمة المرور الجديدة', 'تأكيد كلمة المرور', 'استخدم 8 إلى 200 حرف، تتضمن حرفًا إنجليزيًا كبيرًا ورقمًا.', 'كلمات المرور غير متطابقة', 'إعادة تعيين كلمة المرور', 'تم الحفظ', 'تم إعادة تعيين كلمة المرور. الرجاء تسجيل الدخول.'],
  ['en', 'Verify Code', 'New Password', 'Confirm Password', 'Use 8–200 characters, including an uppercase letter and a number.', 'Passwords do not match', 'Reset Password', 'Saved', 'Password reset successful. Please sign in.'],
])('translates reset validation and success in %s while using the verified session', async (locale, verify, password, confirmation, weak, mismatch, submit, successTitle, successBody) => {
  await act(async () => { await i18n.changeLanguage(locale); });
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  mockReset.mockResolvedValue(undefined);
  const screen = render(<ResetPassword />);
  fireEvent.changeText(screen.getByPlaceholderText('1234'), '1234');
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: verify })); });
  fireEvent.changeText(screen.getByLabelText(password), 'short');
  fireEvent.changeText(screen.getByLabelText(confirmation), 'different');
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: submit })); });
  expect(screen.getByText(weak)).toBeTruthy();
  expect(screen.getByText(mismatch)).toBeTruthy();
  expect(mockReset).not.toHaveBeenCalled();
  fireEvent.changeText(screen.getByLabelText(password), 'Secretpass9');
  fireEvent.changeText(screen.getByLabelText(confirmation), 'Secretpass9');
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: submit })); });
  expect(mockVerify).toHaveBeenCalledWith('test@example.com', '1234');
  expect(mockReset).toHaveBeenCalledWith('session', 'Secretpass9');
  expect(screen.getByLabelText(password).props.value).toBe('');
  expect(screen.getByLabelText(confirmation).props.value).toBe('');
  expect(alert).toHaveBeenCalledWith(successTitle, successBody, expect.any(Array));
  alert.mockRestore();
});


it.each(['test@example.com', ' +966 50 123 4567 '])('prefills and submits a trimmed recovery identifier while preserving continuation for %s', async (identifier) => {
  await act(async () => { await i18n.changeLanguage('en'); });
  mockParams = { identifier, booking: 'booking-context', redirect: '/public-booking/confirm' };
  mockRequest.mockResolvedValue(undefined);
  const screen = render(<ForgotPassword />);
  expect(screen.getByLabelText('Email or phone number').props.value).toBe(identifier);
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Send Code' })); });
  expect(mockRequest).toHaveBeenCalledWith(identifier.trim());
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/(auth)/reset-password', params: { identifier: identifier.trim(), booking: 'booking-context', redirect: '/public-booking/confirm' } });
  expect(screen.getByRole('button', { name: 'Login Now' })).toBeTruthy();
});

it.each(['123', '12a4', '12345'])('rejects reset codes outside the four-digit numeric contract: %s', async (code) => {
  await act(async () => { await i18n.changeLanguage('en'); });
  const screen = render(<ResetPassword />);
  fireEvent.changeText(screen.getByPlaceholderText('1234'), code);
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Verify Code' })); });
  expect(screen.getByText('Invalid or expired code')).toBeTruthy();
  expect(mockVerify).not.toHaveBeenCalled();
});

it.each(['Short9', 'secretpass9', 'Secretpass', `A9${'x'.repeat(199)}`])('enforces the existing upstream password contract before reset: %s', async (password) => {
  await act(async () => { await i18n.changeLanguage('en'); });
  const screen = render(<ResetPassword />);
  fireEvent.changeText(screen.getByPlaceholderText('1234'), '1234');
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Verify Code' })); });
  fireEvent.changeText(screen.getByLabelText('New Password'), password);
  fireEvent.changeText(screen.getByLabelText('Confirm Password'), password);
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Reset Password' })); });
  expect(screen.getByText('Use 8–200 characters, including an uppercase letter and a number.')).toBeTruthy();
  expect(mockReset).not.toHaveBeenCalled();
});

it('uses the current identifier for verification and returns to sign-in with booking context after success', async () => {
  await act(async () => { await i18n.changeLanguage('en'); });
  mockParams = { identifier: '+966501234567', email: 'legacy@example.com', booking: 'booking-context', redirect: '/public-booking/confirm' };
  mockReset.mockResolvedValue(undefined);
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const screen = render(<ResetPassword />);
  expect(screen.getByText('Enter the 4-digit verification code sent to +966501234567')).toBeTruthy();
  fireEvent.changeText(screen.getByPlaceholderText('1234'), '1234');
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Verify Code' })); });
  expect(mockVerify).toHaveBeenCalledWith('+966501234567', '1234');
  fireEvent.changeText(screen.getByLabelText('New Password'), 'Secretpass9');
  fireEvent.changeText(screen.getByLabelText('Confirm Password'), 'Secretpass9');
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Reset Password' })); });
  const buttons = alert.mock.calls[0][2];
  expect(buttons?.[0].text).toBe('Login Now');
  buttons?.[0].onPress?.();
  expect(mockReplace).toHaveBeenCalledWith({ pathname: '/(auth)/login', params: { booking: 'booking-context', redirect: '/public-booking/confirm' } });
  alert.mockRestore();
});
