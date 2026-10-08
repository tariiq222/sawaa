import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { EmailVerificationBanner, requireEmailVerification } from '../EmailVerificationBanner';
let mockUser: { role: string; emailVerified: boolean } | null = { role: 'EMPLOYEE', emailVerified: false };
const mockSend = jest.fn();
jest.mock('@/hooks/use-redux', () => ({ useAppSelector: (select: (state: unknown) => unknown) => select({ auth: { user: mockUser } }) }));
jest.mock('@/services/auth', () => ({ authService: { sendVerificationEmail: () => mockSend() } }));
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ language: 'en', isRTL: false, scheme: 'light', theme: require('@/theme/tokens').buildTheme() }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => ({
  'verification.resend': 'Resend verification link', 'verification.sent': 'Verification link sent',
  'verification.sendError': 'Unable to send', 'verification.dismiss': 'Dismiss verification reminder',
})[key] ?? key }) }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Light: 'light' } }));
beforeEach(() => { mockUser = { role: 'EMPLOYEE', emailVerified: false }; mockSend.mockReset(); });
it('names dismiss and resend actions and announces success after busy state', async () => {
  let resolve: () => void = () => {};
  mockSend.mockImplementation(() => new Promise<void>(done => { resolve = done; }));
  const dismiss = jest.fn();
  const view = render(<EmailVerificationBanner onDismiss={dismiss} />);
  fireEvent.press(view.getByRole('button', { name: 'Dismiss verification reminder' }));
  expect(dismiss).toHaveBeenCalledTimes(1);
  fireEvent.press(view.getByRole('button', { name: 'Resend verification link' }));
  expect(view.getByRole('button', { name: 'Resend verification link' })).toBeDisabled();
  expect(view.getByRole('button', { name: 'Resend verification link' }).props.accessibilityState.busy).toBe(true);
  fireEvent.press(view.getByRole('button', { name: 'Resend verification link' }));
  expect(mockSend).toHaveBeenCalledTimes(1);
  await act(async () => { resolve(); });
  expect(view.getByText('Verification link sent').props.accessibilityLiveRegion).toBe('polite');
  expect(view.getByRole('button', { name: 'Resend verification link' })).toBeEnabled();
});
it('announces failure and permits a retry', async () => {
  mockSend.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
  const view = render(<EmailVerificationBanner />);
  fireEvent.press(view.getByRole('button', { name: 'Resend verification link' }));
  await waitFor(() => expect(view.getByText('Unable to send').props.accessibilityLiveRegion).toBe('polite'));
  fireEvent.press(view.getByRole('button', { name: 'Resend verification link' }));
  await waitFor(() => expect(view.getByText('Verification link sent')).toBeTruthy());
});
it('preserves client and verified user eligibility', () => {
  mockUser = { role: 'CLIENT', emailVerified: false };
  expect(render(<EmailVerificationBanner />).queryByRole('button')).toBeNull();
  expect(requireEmailVerification(mockUser, key => key)).toBe(true);
  mockUser = { role: 'EMPLOYEE', emailVerified: true };
  expect(render(<EmailVerificationBanner />).queryByRole('button')).toBeNull();
});
