import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

// "Try again" on the success screen re-enters this screen with the existing
// bookingId + invoiceId. Paying again must reuse that booking's invoice: a new
// create would hit the backend's overlapping-appointment conflict for the
// same slot.
const mockReplace = jest.fn();
const mockBookingCreate = jest.fn();
const mockGetBooking = jest.fn();
const mockInitPayment = jest.fn();
const mockOpenAuthSession = jest.fn();
// Stable identities: the screen's resume effect depends on router and params.
const mockRouter = { replace: mockReplace, back: jest.fn() };
const mockParams = { bookingId: 'booking-1', invoiceId: 'invoice-1', amount: '45000', currency: 'SAR' };

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => mockRouter,
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('react-native-reanimated', () => {
  const { View: NativeView } = require('react-native') as typeof import('react-native');
  const chain = { delay: () => chain, duration: () => chain, easing: () => chain };
  return { __esModule: true, default: { View: NativeView }, FadeInDown: chain, Easing: { out: () => undefined, cubic: undefined } };
});
jest.mock('lucide-react-native', () => {
  const { View: NativeView } = require('react-native') as typeof import('react-native');
  return { Apple: NativeView, Banknote: NativeView, Check: NativeView, ChevronLeft: NativeView, ChevronRight: NativeView, CreditCard: NativeView };
});
jest.mock('expo-linear-gradient', () => {
  const { View: NativeView } = require('react-native') as typeof import('react-native');
  return { LinearGradient: NativeView };
});
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success' },
}));
jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: (...args: unknown[]) => mockOpenAuthSession(...args) }));
jest.mock('@/theme/sawaa/useSawaaColors', () => ({
  useSawaaColors: () => jest.requireActual('@/theme/sawaa/tokens').getSawaaColors('light'),
}));
jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({ theme: { colors: { primaryFill: '#000', primaryForeground: '#fff', primaryGradient: ['#000', '#111'] } } }),
}));
jest.mock('@/theme/sawaa', () => {
  const { View: NativeView } = require('react-native') as typeof import('react-native');
  return {
    AquaBackground: NativeView,
    sawaaRadius: { pill: 999, xl: 24, md: 12 },
    sawaaSpacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, '2xl': 32 },
    sawaaType: { heading: { fontSize: 24, lineHeight: 30 }, body: { fontSize: 14, lineHeight: 20 }, micro: { fontSize: 11, lineHeight: 14 }, caption: { fontSize: 12, lineHeight: 16 } },
    withAlpha: (color: string) => color,
  };
});
jest.mock('@/theme/components/Glass', () => {
  const { View: NativeView } = require('react-native') as typeof import('react-native');
  return { Glass: NativeView };
});
jest.mock('@/components/ui/BackButton', () => {
  const { View: NativeView } = require('react-native') as typeof import('react-native');
  return { BackButton: NativeView };
});
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ locale: 'en', isRTL: false, row: 'row', textAlign: 'left', alignStart: 'flex-start', writingDirection: 'ltr' }) }));
jest.mock('@/hooks/useA11y', () => ({ useReduceMotion: () => true }));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('@/constants/config', () => ({ APP_SCHEME: 'sawa' }));
jest.mock('@/hooks/use-redux', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) => selector({ auth: { user: { id: 'user-1' } } }),
}));
jest.mock('@/hooks/queries', () => ({ useBankTransferSettings: () => ({ data: undefined }) }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('@/services/client/bookings', () => ({
  clientBookingsService: {
    create: (...args: unknown[]) => mockBookingCreate(...args),
    getById: (...args: unknown[]) => mockGetBooking(...args),
  },
}));
jest.mock('@/services/client/payments', () => ({
  clientPaymentsService: { initPayment: (...args: unknown[]) => mockInitPayment(...args) },
}));

import BookingPaymentScreen from '../payment';

describe('booking payment retry for an existing booking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetBooking.mockResolvedValue({
      id: 'booking-1',
      invoiceId: 'invoice-1',
      status: 'pending',
      branchId: 'branch-1',
      employeeId: 'employee-1',
      serviceId: 'service-1',
      scheduledAt: '2026-10-01T10:00:00.000Z',
      deliveryType: 'IN_PERSON',
    });
    mockInitPayment.mockResolvedValue({ paymentId: 'payment-1', redirectUrl: 'https://checkout.example/pay' });
    mockOpenAuthSession.mockResolvedValue({ type: 'cancel' });
  });

  it('pays the existing invoice without creating a new booking', async () => {
    const screen = render(<BookingPaymentScreen />);
    await waitFor(() => expect(mockGetBooking).toHaveBeenCalledWith('booking-1'));

    await act(async () => {
      fireEvent.press(screen.getByTestId('booking-payment-submit'));
    });

    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
    expect(mockBookingCreate).not.toHaveBeenCalled();
    expect(mockInitPayment).toHaveBeenCalledWith('invoice-1', 'ONLINE_CARD');
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/(client)/booking/success',
      params: {
        bookingId: 'booking-1',
        invoiceId: 'invoice-1',
        paymentId: 'payment-1',
        amount: '45000',
        currency: 'SAR',
        webResult: 'cancel',
      },
    });
  });
});
