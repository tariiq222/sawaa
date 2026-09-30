import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ bookingId: 'booking-1', invoiceId: 'invoice-1' }),
  useRouter: () => ({ back: jest.fn(), replace: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn().mockResolvedValue({ type: 'dismiss' }) }));
jest.mock('@/constants/config', () => ({ APP_SCHEME: 'sawa' }));
let mockRTL = false;
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ locale: mockRTL ? 'ar' : 'en', isRTL: mockRTL, textAlign: mockRTL ? 'right' : 'left' }) }));
jest.mock('@/hooks/queries', () => ({
  useGroupSession: () => ({ data: { title: 'Program' } }),
  useBranding: () => ({ data: { contactPhone: null } }),
}));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
let mockScheme: 'light' | 'dark' = 'light';
jest.mock('@/theme/sawaa/useSawaaColors', () => ({
  useSawaaColors: () => jest.requireActual('@/theme/sawaa/tokens').getSawaaColors(mockScheme),
}));
jest.mock('@/lib/money', () => ({ formatHalalas: (amount: number) => String(amount) }));
jest.mock('@/services/client/payments', () => ({ clientPaymentsService: { initPayment: jest.fn() } }));
jest.mock('@/features/booking/use-existing-booking-checkout', () => {
  const checkAgain = jest.fn();
  const invoice: { id: string; total?: number | string; currency: string; status: string; payments?: { id: string; status: string; amount?: number | string }[] } = {
    id: 'invoice-1', total: 10000, currency: 'SAR', status: 'DRAFT', payments: [],
  };
  return {
    __mockCheckAgain: checkAgain,
    __mockInvoice: invoice,
    useExistingBookingCheckout: () => ({
    phase: 'ready',
    invoice,
    booking: { id: 'booking-1', invoiceId: 'invoice-1', status: 'pending', scheduledAt: '' },
    isRefreshing: false,
      checkAgain,
    }),
    canResumeHostedPayment: () => false,
    canStartHostedPayment: () => true,
  };
});
jest.mock('@/theme/components/Glass', () => ({
  Glass: ({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) => {
    const { Pressable } = require('react-native') as typeof import('react-native');
    return <Pressable onPress={onPress}>{children}</Pressable>;
  },
}));
jest.mock('@/theme/sawaa', () => {
  const { View } = require('react-native') as typeof import('react-native');
  const mockReact = require('react') as typeof import('react');
  return {
    AquaBackground: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
    PrimaryButton: ({ label, onPress, disabled }: { label: string; onPress?: () => void; disabled?: boolean }) =>
      mockReact.createElement('mock-primary-button', { testID: 'primary', onPress, disabled }, label),
    sawaaRadius: { pill: 999, xl: 24 },
    sawaaSpacing: { lg: 16 },
    sawaaType: { heading: { fontSize: 24, lineHeight: 30 }, body: { fontSize: 14, lineHeight: 20 }, micro: { fontSize: 11, lineHeight: 14 }, caption: { fontSize: 12, lineHeight: 16 } },
  };
});
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, options?: { amount: string; currency: string }) =>
  key === 'checkout.currency' && options ? `${options.amount} ${options.currency}` : key }) }));

import ExistingBookingCheckoutScreen from '../checkout';

const mockInitPayment = require('@/services/client/payments').clientPaymentsService.initPayment as jest.Mock;
const mockCheckAgain = require('@/features/booking/use-existing-booking-checkout').__mockCheckAgain as jest.Mock;
const mockInvoice = require('@/features/booking/use-existing-booking-checkout').__mockInvoice as {
  total?: number | string;
  payments?: { id: string; status: string; amount?: number | string }[];
};

describe('ExistingBookingCheckoutScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRTL = false;
    mockScheme = 'light';
    mockInvoice.total = 10000;
    mockInvoice.payments = [];
    mockInitPayment.mockResolvedValue({ paymentId: 'payment-1', redirectUrl: '' });
  });

  it('updates visible text colors when the appearance changes without remounting', () => {
    const { StyleSheet } = require('react-native') as typeof import('react-native');
    const { getSawaaColors } = jest.requireActual('@/theme/sawaa/tokens') as typeof import('@/theme/sawaa/tokens');
    const screen = render(<ExistingBookingCheckoutScreen />);
    expect(StyleSheet.flatten(screen.getByText('checkout.title').props.style).color).toBe(getSawaaColors('light').ink[900]);
    mockScheme = 'dark';
    screen.rerender(<ExistingBookingCheckoutScreen />);
    expect(StyleSheet.flatten(screen.getByText('checkout.title').props.style).color).toBe(getSawaaColors('dark').ink[900]);
  });

  it('shows the remaining amount after a completed partial payment', () => {
    mockInvoice.total = 12000;
    mockInvoice.payments = [{ id: 'paid-1', status: 'COMPLETED', amount: 5000 }];
    const screen = render(<ExistingBookingCheckoutScreen />);
    expect(screen.getByText('7000 SAR')).toBeTruthy();
    expect(screen.getByText('checkout.remainingAmount')).toBeTruthy();
  });

  it('ignores pending, failed and refunded payments when calculating the balance', () => {
    mockInvoice.total = 12000;
    mockInvoice.payments = [
      { id: 'paid-1', status: 'COMPLETED', amount: 5000 },
      { id: 'pending-1', status: 'PENDING', amount: 2000 },
      { id: 'failed-1', status: 'FAILED', amount: 1000 },
      { id: 'refunded-1', status: 'REFUNDED', amount: 500 },
    ];
    const screen = render(<ExistingBookingCheckoutScreen />);
    expect(screen.getByText('7000 SAR')).toBeTruthy();
  });

  it('shows the full amount with no payments', () => {
    const screen = render(<ExistingBookingCheckoutScreen />);
    expect(screen.getByText('10000 SAR')).toBeTruthy();
  });

  it('subtracts completed payment amounts returned as decimal strings', () => {
    mockInvoice.total = '12000';
    mockInvoice.payments = [{ id: 'paid-1', status: 'COMPLETED', amount: '5000' }];
    const screen = render(<ExistingBookingCheckoutScreen />);
    expect(screen.getByText('7000 SAR')).toBeTruthy();
  });

  it('clamps an overpaid invoice balance to zero', () => {
    mockInvoice.total = 12000;
    mockInvoice.payments = [{ id: 'paid-1', status: 'COMPLETED', amount: 13000 }];
    const screen = render(<ExistingBookingCheckoutScreen />);
    expect(screen.getByText('0 SAR')).toBeTruthy();
  });

  it.each([
    { total: undefined, payments: [] },
    { total: 'bad', payments: [] },
    { total: 12000, payments: [{ id: 'paid-1', status: 'COMPLETED', amount: undefined }] },
    { total: 12000, payments: [{ id: 'paid-1', status: 'COMPLETED', amount: -1 }] },
    { total: 12000, payments: [{ id: 'paid-1', status: 'COMPLETED', amount: NaN }] },
    { total: 12000, payments: [{ id: 'paid-1', status: 'COMPLETED', amount: Infinity }] },
    { total: 12000, payments: [{ id: 'paid-1', status: 'COMPLETED', amount: '' }] },
    { total: 12000, payments: [{ id: 'paid-1', status: 'COMPLETED', amount: 1.5 }] },
    { total: 12000, payments: undefined },
  ])('shows unavailable for missing or invalid monetary data: %j', ({ total, payments }) => {
    mockInvoice.total = total;
    mockInvoice.payments = payments;
    const screen = render(<ExistingBookingCheckoutScreen />);
    expect(screen.getByText('checkout.amountUnavailable')).toBeTruthy();
    expect(screen.queryByText(/NaN/)).toBeNull();
  });

  it('starts one hosted payment when the button is tapped twice in the same frame', async () => {
    const screen = render(<ExistingBookingCheckoutScreen />);
    const button = screen.getAllByTestId('primary')[0];

    await act(async () => {
      button.props.onPress();
      button.props.onPress();
    });

    await waitFor(() => expect(mockInitPayment).toHaveBeenCalledTimes(1));
    expect(mockInitPayment).toHaveBeenCalledWith('invoice-1', 'ONLINE_CARD');
    expect(mockCheckAgain).toHaveBeenCalledTimes(1);
  });
  it.each([false, true])('aligns rendered details with the locale (RTL=%s)', (rtl) => {
    mockRTL = rtl;
    const { StyleSheet } = require('react-native') as typeof import('react-native');
    const screen = render(<ExistingBookingCheckoutScreen />);
    for (const text of ['checkout.program', 'Program', 'checkout.remainingAmount', '10000 SAR']) {
      expect(StyleSheet.flatten(screen.getByText(text).props.style).textAlign).toBe(rtl ? 'right' : 'left');
    }
  });

});
