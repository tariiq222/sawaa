import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

const mockRefetchBooking = jest.fn();
const mockCheckAgain = jest.fn();
const mockReplace = jest.fn();
let mockBooking: { id: string; status: string } | undefined;
let mockBookingError = false;
let mockPhase: 'confirmed' | 'pending' | 'failed' = 'confirmed';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ bookingId: 'booking-1', invoiceId: 'invoice-1' }),
  useRouter: () => ({ replace: mockReplace, back: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('react-native-reanimated', () => {
  const { View: NativeView } = require('react-native') as typeof import('react-native');
  const animated = { View: NativeView };
  return {
    __esModule: true,
    default: animated,
    Easing: { out: () => undefined, cubic: () => undefined },
    FadeInDown: { delay: () => ({ duration: () => ({ easing: () => undefined }) }), duration: () => ({ easing: () => undefined }) },
    ZoomIn: { duration: () => ({ easing: () => undefined }) },
  };
});
jest.mock('lucide-react-native', () => {
  const { View: NativeView } = require('react-native') as typeof import('react-native');
  return { Calendar: NativeView, Check: NativeView, CircleAlert: NativeView, Clock: NativeView, Hash: NativeView, User: NativeView };
});
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ scheme: 'light' }) }));
jest.mock('react-i18next', () => ({ __esModule: true, initReactI18next: { type: '3rdParty', init: () => undefined }, useTranslation: () => ({ t: (key: string) => key === 'booking.backToHome' ? 'Back to home' : key }) }));
jest.mock('@/theme/sawaa/useSawaaColors', () => ({
  useSawaaColors: () => jest.requireActual('@/theme/sawaa/tokens').getSawaaColors('light'),
}));
jest.mock('@/theme/sawaa', () => {
  const { View: NativeView } = require('react-native') as typeof import('react-native');
  return {
    AquaBackground: NativeView,
    sawaaRadius: { pill: 999, xl: 24 },
    sawaaSpacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, '2xl': 32 },
    sawaaType: { heading: { fontSize: 24, lineHeight: 30 }, body: { fontSize: 14, lineHeight: 20 }, micro: { fontSize: 11, lineHeight: 14 }, caption: { fontSize: 12, lineHeight: 16 } },
    withAlpha: (color: string) => color,
  };
});
jest.mock('@/theme/components/Glass', () => {
  const { View: NativeView } = require('react-native') as typeof import('react-native');
  return { Glass: NativeView };
});
jest.mock('@/theme/sawaa/PrimaryButton', () => {
  const { Pressable, Text } = require('react-native') as typeof import('react-native');
  return { PrimaryButton: ({ label, onPress }: { label: string; onPress: () => void }) =>
    <Pressable onPress={onPress}><Text>{label}</Text></Pressable> };
});
jest.mock('@/components/ui/Skeleton', () => {
  const { View: NativeView } = require('react-native') as typeof import('react-native');
  return { Skeleton: NativeView };
});
let mockRTL = false;
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ locale: mockRTL ? 'ar' : 'en', isRTL: mockRTL, textAlign: mockRTL ? 'right' : 'left', writingDirection: 'ltr' }) }));
jest.mock('@/hooks/useA11y', () => ({ useReduceMotion: () => true }));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('@/hooks/queries', () => ({
  useBooking: () => ({ data: mockBooking, isLoading: false, isError: mockBookingError, refetch: mockRefetchBooking }),
}));
jest.mock('@/features/booking/use-payment-status', () => {
  const actual = jest.requireActual('@/features/booking/use-payment-status') as typeof import('@/features/booking/use-payment-status');
  return { ...actual, usePaymentStatus: () => ({ phase: mockPhase, checkAgain: mockCheckAgain }) };
});

import BookingSuccessScreen from '../success';

describe('booking success verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRTL = false;
    mockBooking = { id: 'booking-1', status: 'PENDING' };
    mockBookingError = false;
    mockPhase = 'confirmed';
    mockRefetchBooking.mockResolvedValue({ data: mockBooking });
  });

  it('rechecks the booking along with the invoice when the user taps Check again', async () => {
    const screen = render(<BookingSuccessScreen />);
    await act(async () => { fireEvent.press(screen.getByText('Check again')); });
    expect(mockCheckAgain).toHaveBeenCalledTimes(1);
    expect(mockRefetchBooking).toHaveBeenCalledTimes(1);
  });

  it('does not show appointment confirmation when booking retrieval fails', () => {
    mockBooking = undefined;
    mockBookingError = true;
    const screen = render(<BookingSuccessScreen />);
    expect(screen.queryByText('Appointment confirmed')).toBeNull();
    expect(screen.getByText('Check again')).toBeTruthy();
  });

  it('can show confirmation after a successful booking refresh', async () => {
    const screen = render(<BookingSuccessScreen />);
    expect(screen.queryByText('Appointment confirmed')).toBeNull();
    mockRefetchBooking.mockImplementation(async () => {
      mockBooking = { id: 'booking-1', status: 'CONFIRMED' };
      screen.rerender(<BookingSuccessScreen />);
      return { data: mockBooking };
    });
    await act(async () => { fireEvent.press(screen.getByText('Check again')); });
    await waitFor(() => expect(screen.getByText('Appointment confirmed')).toBeTruthy());
  });

  it('confirms the deposit appointment and states that a balance remains due', () => {
    mockBooking = { id: 'booking-1', status: 'DEPOSIT_PAID' };
    mockPhase = 'pending';
    const screen = render(<BookingSuccessScreen />);
    expect(screen.getByText('Appointment confirmed')).toBeTruthy();
    expect(screen.getByText('Deposit received. The remaining balance is still due.')).toBeTruthy();
    expect(screen.queryByText('Confirming appointment')).toBeNull();
  });

  it('retries payment against the existing booking and invoice', () => {
    mockPhase = 'failed';
    const screen = render(<BookingSuccessScreen />);
    fireEvent.press(screen.getByText('Try again'));

    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/(client)/booking/payment',
      params: { bookingId: 'booking-1', invoiceId: 'invoice-1' },
    });
  });
  it.each([false, true])('aligns rendered details with the locale (RTL=%s)', (rtl) => {
    mockRTL = rtl;
    const { StyleSheet } = require('react-native') as typeof import('react-native');
    const screen = render(<BookingSuccessScreen />);
    for (const text of [mockRTL ? 'رقم الموعد' : 'Booking #']) {
      expect(StyleSheet.flatten(screen.getByText(text).props.style).textAlign).toBe(rtl ? 'right' : 'left');
    }
  });

});
