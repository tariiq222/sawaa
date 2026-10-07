import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

const mockReplace = jest.fn();
const mockReset = jest.fn();
const mockVerify = jest.fn();
const mockRequest = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }), useLocalSearchParams: () => ({ email: 'test@example.com' }) }));
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

beforeEach(() => { jest.clearAllMocks(); mockVerify.mockResolvedValue({ sessionToken: 'session' }); });
afterEach(async () => { await act(async () => { await i18n.changeLanguage('ar'); }); });

it.each([
  ['ar', 'نسيت كلمة المرور', 'إرسال الرمز', 'البريد الإلكتروني غير صالح'],
  ['en', 'Forgot Password', 'Send Code', 'Invalid email address'],
])('translates recovery and invalid email in %s', async (locale, title, submit, error) => {
  await act(async () => { await i18n.changeLanguage(locale); });
  const screen = render(<ForgotPassword />);
  expect(screen.getByText(title)).toBeTruthy();
  await act(async () => { fireEvent.press(screen.getByText(submit)); });
  expect(screen.getByText(error)).toBeTruthy();
  expect(mockRequest).not.toHaveBeenCalled();
});

it.each([
  ['ar', 'أدخل الرمز المكوّن من 6 أرقام المرسل إلى test@example.com', 'تحقق من الرمز', 'رمز غير صالح أو منتهي الصلاحية'],
  ['en', 'Enter the 6-digit code sent to test@example.com', 'Verify Code', 'Invalid or expired code'],
])('interpolates the recipient and translates invalid reset code in %s', async (locale, subtitle, verify, error) => {
  await act(async () => { await i18n.changeLanguage(locale); });
  const screen = render(<ResetPassword />);
  expect(screen.getByText(subtitle)).toBeTruthy();
  await act(async () => { fireEvent.press(screen.getByText(verify)); });
  expect(screen.getByText(error)).toBeTruthy();
  expect(mockVerify).not.toHaveBeenCalled();
});

it('shows an English server-failure alert and keeps the reset form available', async () => {
  await act(async () => { await i18n.changeLanguage('en'); });
  mockVerify.mockRejectedValue(new Error('offline'));
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const screen = render(<ResetPassword />);
  fireEvent.changeText(screen.getByPlaceholderText('123456'), '123456');
  fireEvent.press(screen.getByText('Verify Code'));
  await waitFor(() => expect(alert).toHaveBeenCalledWith('An error occurred', 'Invalid or expired code'));
  expect(screen.getByText('Verify Code')).toBeTruthy();
  alert.mockRestore();
});

it.each([
  ['ar', 'تحقق من الرمز', 'كلمة المرور الجديدة', 'تأكيد كلمة المرور', 'كلمة المرور يجب أن تكون 8 أحرف على الأقل', 'كلمات المرور غير متطابقة', 'إعادة تعيين كلمة المرور', 'تم الحفظ', 'تم إعادة تعيين كلمة المرور. الرجاء تسجيل الدخول.'],
  ['en', 'Verify Code', 'New Password', 'Confirm Password', 'Password must be at least 8 characters', 'Passwords do not match', 'Reset Password', 'Saved', 'Password reset successful. Please sign in.'],
])('translates reset validation and success in %s while using the verified session', async (locale, verify, password, confirmation, weak, mismatch, submit, successTitle, successBody) => {
  await act(async () => { await i18n.changeLanguage(locale); });
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  mockReset.mockResolvedValue(undefined);
  const screen = render(<ResetPassword />);
  fireEvent.changeText(screen.getByPlaceholderText('123456'), '123456');
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
  expect(mockReset).toHaveBeenCalledWith('session', 'Secretpass9');
  expect(alert).toHaveBeenCalledWith(successTitle, successBody, expect.any(Array));
  alert.mockRestore();
});
