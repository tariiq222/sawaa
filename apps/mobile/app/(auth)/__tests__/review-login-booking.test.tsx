import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
const mockReplace = jest.fn();
let mockBooking: string | undefined;
let mockRedirect: string | undefined;
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ booking: mockBooking, redirect: mockRedirect }),
  useRouter: () => ({ replace: mockReplace, back: jest.fn() }),
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('@/theme/sawaa/useSawaaColors', () => ({ useSawaaColors: () => jest.requireActual('@/theme/sawaa/tokens').getSawaaColors('light') }));
jest.mock('@/theme/sawaa', () => {
  const { View, Pressable, Text } = require('react-native') as typeof import('react-native');
  return { AquaBackground: View, PrimaryButton: ({ label, onPress, disabled }: { label: string; onPress: () => void; disabled: boolean }) => <Pressable disabled={disabled} onPress={onPress}><Text>{label}</Text></Pressable> };
});
jest.mock('@/theme/components/ThemedText', () => ({ ThemedText: require('react-native').Text }));
jest.mock('@/components/ui/BackButton', () => ({ BackButton: () => null }));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('@/hooks/useDir', () => ({ useDir: () => jest.requireActual('@/hooks/useDir').buildDirState('ar') }));
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ theme: require('@/theme/tokens').buildTheme(), scheme: 'light', language: 'ar' }) }));
jest.mock('@/hooks/use-redux', () => ({ useAppDispatch: () => jest.fn() }));
jest.mock('@/stores/slices/auth-slice', () => ({ setCredentials: jest.fn() }));
jest.mock('@/services/auth', () => ({
  loginReviewAccount: jest.fn().mockResolvedValue({ sessionEpoch: 1, tokens: { accessToken: 'test' } }),
  authService: { getProfile: jest.fn().mockResolvedValue({ success: true, data: { id: 'user-1', role: 'CLIENT' } }) },
  SessionSupersededError: class extends Error {},
}));
jest.mock('@/services/native-session-state', () => ({ isSessionCurrent: () => true, clearSessionAtEpoch: jest.fn() }));
import ReviewLoginScreen from '../review-login';

describe('review login booking continuation', () => {
  beforeEach(() => { jest.clearAllMocks(); mockBooking = undefined; mockRedirect = undefined; });
  const signIn = () => {
    const screen = render(<ReviewLoginScreen />);
    fireEvent.changeText(screen.getByLabelText('auth.email'), 'review@example.test');
    fireEvent.changeText(screen.getByLabelText('auth.password'), 'test-only');
    fireEvent.press(screen.getByText('auth.review.submit'));
  };
  it('returns a new booking draft to confirmation with the practitioner price', async () => {
    mockBooking = JSON.stringify({ clinicId: 'clinic-1', serviceId: 'service-1', employeeId: 'employee-1', branchId: 'branch-1', deliveryType: 'in_person', scheduledAt: '2026-10-01T10:00:00.000Z', amount: '45000', currency: 'SAR' });
    signIn();
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/(client)/booking/confirm',
      params: { clinicId: 'clinic-1', serviceId: 'service-1', employeeId: 'employee-1', branchId: 'branch-1', deliveryType: 'in_person', scheduledAt: '2026-10-01T10:00:00.000Z', chargedPrice: '45000', currency: 'SAR' },
    }));
  });
  it('preserves a guarded existing-invoice payment resume route', async () => {
    mockRedirect = '/(client)/booking/payment?bookingId=booking-1&invoiceId=invoice-1';
    signIn();
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith({ pathname: '/(client)/booking/payment', params: { bookingId: 'booking-1', invoiceId: 'invoice-1' } }));
  });
});

it('keeps native credential hints and disables both inputs while the existing submit is pending', async () => {
 let finish!: (value: unknown) => void;
 const { loginReviewAccount } = jest.requireMock('@/services/auth');
 loginReviewAccount.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
 const view = render(<ReviewLoginScreen />);
 expect(view.getByLabelText('auth.email').props.textContentType).toBe('username');
 fireEvent.changeText(view.getByLabelText('auth.email'), 'review@example.test');
 fireEvent.changeText(view.getByLabelText('auth.password'), 'test-only');
 await act(async () => { fireEvent(view.getByLabelText('auth.password'), 'submitEditing'); });
 expect(view.getByLabelText('auth.email').props.editable).toBe(false);
 expect(view.getByLabelText('auth.password').props.editable).toBe(false);
 await act(async () => finish({ sessionEpoch: 1, tokens: { accessToken: 'test' } }));
});
