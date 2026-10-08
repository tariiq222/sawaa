import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { DirContext, buildDirState } from '@/hooks/useDir';
import ar from '@/i18n/ar.json';
import en from '@/i18n/en.json';
const mockRequest = jest.fn();
const mockVerify = jest.fn();
const mockReset = jest.fn();
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ email: 'a@example.com', booking: 'preserved', redirect: '/(client)/records' }), useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ theme: require('@/theme/tokens').buildTheme(), scheme: 'light', language: 'ar' }) }));
jest.mock('@/theme', () => ({ Glass: require('@/theme/components/Glass').Glass }));
jest.mock('@/services/auth', () => ({ authService: { requestPasswordResetOtp: (email: string) => mockRequest(email), verifyPasswordResetOtp: (email: string, code: string) => mockVerify(email, code), resetClientPassword: (token: string, password: string) => mockReset(token, password) } }));
jest.mock('expo-haptics', () => ({ notificationAsync: jest.fn(), impactAsync: jest.fn(), NotificationFeedbackType: { Error: 'error', Success: 'success' }, ImpactFeedbackStyle: { Light: 'light' } }));
import ForgotPasswordScreen from '../forgot-password';
import ResetPasswordScreen from '../reset-password';
beforeEach(() => { jest.clearAllMocks(); mockVerify.mockResolvedValue({ sessionToken: 's' }); });
for (const locale of ['ar', 'en'] as const) {
 const resources = locale === 'ar' ? ar : en;
 const localized = (node: React.ReactNode) => {
  const i18n = createInstance();
  void i18n.init({ lng: locale, resources: { [locale]: { translation: resources } }, initImmediate: false, showSupportNotice: false });
  return render(<I18nextProvider i18n={i18n}><DirContext.Provider value={buildDirState(locale)}>{node}</DirContext.Provider></I18nextProvider>);
 };
 it(`${locale}: localizes recovery and rejects invalid email without requesting a code`, async () => {
  const view = localized(<ForgotPasswordScreen />);
  expect(view.getByText(resources.auth.forgotPassword.title)).toBeTruthy();
  fireEvent.changeText(view.getByLabelText(resources.auth.forgotPassword.emailLabel), 'bad');
  await act(async () => fireEvent.press(view.getByText(resources.auth.forgotPassword.submit)));
  expect(view.getByText(resources.auth['register.emailError'])).toBeTruthy();
  expect(mockRequest).not.toHaveBeenCalled();
 });
 it(`${locale}: preserves four-character verification and rejects short or mismatching passwords`, async () => {
  const view = localized(<ResetPasswordScreen />);
  fireEvent.changeText(view.getByLabelText(resources.auth.resetPassword.codeLabel), '1234');
  await act(async () => fireEvent.press(view.getByText(resources.auth.resetPassword.verifyCode)));
  expect(mockVerify).toHaveBeenCalledWith('a@example.com', '1234');
  fireEvent.changeText(view.getByLabelText(resources.auth.resetPassword.newPasswordLabel), '1234567');
  fireEvent.changeText(view.getByLabelText(resources.auth.resetPassword.confirmPasswordLabel), '1234567');
  await act(async () => fireEvent.press(view.getByText(resources.auth.resetPassword.submit)));
  expect(view.getByText(resources.auth.resetPassword.weakPassword)).toBeTruthy();
  expect(mockReset).not.toHaveBeenCalled();
  fireEvent.changeText(view.getByLabelText(resources.auth.resetPassword.newPasswordLabel), '12345678');
  fireEvent.changeText(view.getByLabelText(resources.auth.resetPassword.confirmPasswordLabel), '87654321');
  await act(async () => fireEvent.press(view.getByText(resources.auth.resetPassword.submit)));
  expect(view.getByText(resources.auth.resetPassword.mismatch)).toBeTruthy();
  expect(mockReset).not.toHaveBeenCalled();
 });
}
