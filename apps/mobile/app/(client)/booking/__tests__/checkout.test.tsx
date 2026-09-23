import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ bookingId: 'booking-1', invoiceId: 'invoice-1' }),
  useRouter: () => ({ back: jest.fn(), replace: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn().mockResolvedValue({ type: 'dismiss' }) }));
jest.mock('@/constants/config', () => ({ APP_SCHEME: 'sawa' }));
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ locale: 'en', isRTL: false, textAlign: 'left' }) }));
jest.mock('@/hooks/queries', () => ({
  useGroupSession: () => ({ data: { title: 'Program' } }),
  useBranding: () => ({ data: { contactPhone: null } }),
}));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('@/lib/money', () => ({ formatHalalas: (amount: number) => String(amount) }));
jest.mock('@/services/client/payments', () => ({ clientPaymentsService: { initPayment: jest.fn() } }));
jest.mock('../use-existing-booking-checkout', () => {
  const checkAgain = jest.fn();
  return {
    __mockCheckAgain: checkAgain,
    useExistingBookingCheckout: () => ({
    phase: 'ready',
    invoice: { id: 'invoice-1', total: 10000, currency: 'SAR', status: 'DRAFT', payments: [] },
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
    sawaaColors: { ink: { 700: '#000', 900: '#000', 500: '#555' }, teal: { 600: '#000', 700: '#000' }, glass: { bgStrong: '#fff' } },
    sawaaRadius: { pill: 999, xl: 24 },
    sawaaSpacing: { lg: 16 },
    sawaaType: { heading: { fontSize: 24, lineHeight: 30 }, body: { fontSize: 14, lineHeight: 20 }, micro: { fontSize: 11, lineHeight: 14 }, caption: { fontSize: 12, lineHeight: 16 } },
  };
});
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import ExistingBookingCheckoutScreen from '../checkout';

const mockInitPayment = require('@/services/client/payments').clientPaymentsService.initPayment as jest.Mock;
const mockCheckAgain = require('../use-existing-booking-checkout').__mockCheckAgain as jest.Mock;

describe('ExistingBookingCheckoutScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInitPayment.mockResolvedValue({ paymentId: 'payment-1', redirectUrl: '' });
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
});
