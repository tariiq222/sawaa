import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

// End-to-end on the success screen with the real payment-status hook: the
// client tapped Pay, the backend created a PENDING card payment, and the
// client closed the Moyasar page.
const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockGetInvoice = jest.fn();
let mockParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ replace: mockReplace, back: mockBack }),
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
const mockRTL = false;
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ locale: mockRTL ? 'ar' : 'en', isRTL: mockRTL, textAlign: mockRTL ? 'right' : 'left', writingDirection: 'ltr' }) }));
jest.mock('@/hooks/useA11y', () => ({ useReduceMotion: () => true }));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('@/hooks/queries', () => ({
  useBooking: () => ({ data: { id: 'booking-1', status: 'PENDING' }, isLoading: false, isError: false, refetch: jest.fn() }),
}));
jest.mock('@/services/client/payments', () => ({
  clientPaymentsService: { getInvoice: (...args: unknown[]) => mockGetInvoice(...args) },
}));

import BookingSuccessScreen from '../success';

const pendingCardInvoice = {
  id: 'invoice-1',
  status: 'PENDING',
  payments: [{ id: 'payment-1', status: 'PENDING', method: 'ONLINE_CARD' }],
};

async function advance(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

describe('booking success after the client closed the card gateway', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockParams = {
      bookingId: 'booking-1',
      invoiceId: 'invoice-1',
      paymentId: 'payment-1',
      amount: '45000',
      currency: 'SAR',
      webResult: 'cancel',
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('offers a retry that resumes the same booking and invoice', async () => {
    mockGetInvoice.mockResolvedValue(pendingCardInvoice);
    const screen = render(<BookingSuccessScreen />);
    await advance(6000);

    expect(screen.getByText('Payment not completed')).toBeTruthy();
    expect(screen.queryByText('Check again')).toBeNull();
    fireEvent.press(screen.getByText('Try again'));

    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/(client)/booking/payment',
      params: { bookingId: 'booking-1', invoiceId: 'invoice-1', amount: '45000', currency: 'SAR' },
    });
  });

  it('keeps a pending bank transfer on the processing state', async () => {
    mockGetInvoice.mockResolvedValue({
      ...pendingCardInvoice,
      payments: [{ id: 'payment-1', status: 'PENDING', method: 'BANK_TRANSFER' }],
    });
    const screen = render(<BookingSuccessScreen />);
    await advance(0);

    expect(screen.getByText('Payment processing')).toBeTruthy();
    expect(screen.getByText('Check again')).toBeTruthy();
    expect(screen.queryByText('Try again')).toBeNull();
  });

  it('falls back to going back when the booking identity is missing', async () => {
    mockParams = { invoiceId: 'invoice-1', webResult: 'dismiss' };
    mockGetInvoice.mockResolvedValue(pendingCardInvoice);
    const screen = render(<BookingSuccessScreen />);
    await advance(6000);

    fireEvent.press(screen.getByText('Try again'));
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
