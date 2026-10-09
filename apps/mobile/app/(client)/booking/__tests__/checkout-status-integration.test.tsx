import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import ExistingBookingCheckoutScreen from '../checkout';
import { clientBookingsService } from '@/services/client/bookings';
import { clientPaymentsService } from '@/services/client/payments';
import { queryClient } from '@/services/query-client';
import en from '@/i18n/en.json';
import ar from '@/i18n/ar.json';

let mockLocale: 'en' | 'ar' = 'en';
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ bookingId: 'booking', invoiceId: 'invoice' }),
  useRouter: () => ({ replace: mockReplace, canGoBack: () => false }),
  useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('react-i18next', () => ({ ...jest.requireActual('react-i18next'), useTranslation: () => ({ t: (key: string) => {
  const dictionary = require(mockLocale === 'ar' ? '@/i18n/ar.json' : '@/i18n/en.json');
  return key.split('.').reduce((value, part) => value?.[part], dictionary) ?? key;
} }) }));
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ locale: mockLocale, isRTL: mockLocale === 'ar', textAlign: mockLocale === 'ar' ? 'right' : 'left', writingDirection: mockLocale === 'ar' ? 'rtl' : 'ltr' }) }));
jest.mock('@/hooks/queries', () => ({ useBranding: () => ({ data: { contactPhone: '0000000000' } }), useGroupSession: () => ({ data: undefined }) }));
jest.mock('@/services/client/bookings', () => ({ clientBookingsService: { getById: jest.fn() } }));
jest.mock('@/services/client/payments', () => ({ clientPaymentsService: { getInvoice: jest.fn(), initNativePayment: jest.fn() } }));
jest.mock('@/theme/ThemeProvider', () => ({ useTheme: () => ({ scheme: 'light', theme: require('@/theme/tokens').buildTheme(null, 'light') }) }));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('@/theme/sawaa/useSawaaColors', () => ({ useSawaaColors: () => jest.requireActual('@/theme/sawaa/tokens').getSawaaColors('light') }));
jest.mock('@/theme/sawaa/AquaBackground', () => ({ AquaBackground: ({ children }: { children: React.ReactNode }) => {
  const { View } = require('react-native'); return <View>{children}</View>;
} }));
jest.mock('@/theme/components/Glass', () => ({ Glass: ({ children }: { children: React.ReactNode }) => {
  const { View } = require('react-native'); return <View>{children}</View>;
} }));
const booking = { id: 'booking', invoiceId: 'invoice', status: 'pending', scheduledAt: '', serviceName: 'Session' };
const invoice = { id: 'invoice', status: 'ISSUED', total: 10000, currency: 'SAR', payments: [] };
beforeEach(() => {
  jest.restoreAllMocks(); jest.clearAllMocks(); queryClient.clear(); mockLocale = 'en';
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
  jest.mocked(clientBookingsService.getById).mockResolvedValue(booking as Awaited<ReturnType<typeof clientBookingsService.getById>>);
  jest.mocked(clientPaymentsService.getInvoice).mockResolvedValue(invoice);
});
afterEach(() => queryClient.clear());

it.each(['en', 'ar'] as const)('offers status verification without claiming processing for an unresolved reserved payment (%s)', async (locale) => {
  mockLocale = locale;
  jest.mocked(clientPaymentsService.getInvoice).mockResolvedValue({ ...invoice, payments: [{ id: 'reserved', status: 'PENDING', method: 'ONLINE_CARD' }] });
  const view = render(<ExistingBookingCheckoutScreen />);
  const dictionary = locale === 'ar' ? ar : en;
  await waitFor(() => expect(view.getByText((locale === 'ar' ? 'التحقق من حالة الدفع' : 'Check payment status'))).toBeTruthy());
  expect(view.queryByText(locale === 'ar' ? 'الدفع قيد المعالجة' : 'Payment is processing')).toBeNull();
  expect(view.queryByText(dictionary.checkout.continue)).toBeNull();
  fireEvent.press(view.getByText((locale === 'ar' ? 'التحقق من حالة الدفع' : 'Check payment status')));
  expect(mockReplace).toHaveBeenCalledWith({ pathname: '/(client)/payments/native-checkout', params: { invoiceId: 'invoice', bookingId: 'booking' } });
  expect(clientPaymentsService.initNativePayment).not.toHaveBeenCalled();
  view.unmount();
});

it('offers payment directly when an issued invoice has no payment attempt', async () => {
  const view = render(<ExistingBookingCheckoutScreen />);
  await waitFor(() => expect(view.getByRole('button', { name: en.checkout.continue })).toBeTruthy());
  expect(view.queryByText('Payment is processing')).toBeNull();
  expect(view.queryByText('Check payment status')).toBeNull();
  view.unmount();
});

it.each(['PENDING', 'PENDING_VERIFICATION'])('keeps bank transfer %s blocked from another payment', async (status) => {
  jest.mocked(clientPaymentsService.getInvoice).mockResolvedValue({ ...invoice, payments: [{ id: 'transfer', status, method: 'BANK_TRANSFER' }] });
  const view = render(<ExistingBookingCheckoutScreen />);
  await waitFor(() => expect(view.getByText(en.checkout.retry)).toBeTruthy());
  expect(view.queryByText(en.checkout.continue)).toBeNull();
  expect(view.queryByText('Check payment status')).toBeNull();
  expect(mockReplace).not.toHaveBeenCalled();
  view.unmount();
});


it.each(['en', 'ar'] as const)('distinguishes received payment from delayed appointment confirmation without pay or retry (%s)', async (locale) => {
  mockLocale = locale;
  jest.mocked(clientPaymentsService.getInvoice).mockResolvedValue({ ...invoice, status: 'PAID', payments: [{ id: 'paid', status: 'COMPLETED', amount: 10000 }] });
  const view = render(<ExistingBookingCheckoutScreen />);
  const dictionary = locale === 'ar' ? ar : en;
  await waitFor(() => expect(view.getByText(locale === 'ar' ? 'تم الدفع، وجارٍ تأكيد الموعد' : 'Payment received; confirming your appointment')).toBeTruthy());
  expect(view.queryByText(dictionary.checkout.pending)).toBeNull();
  expect(view.queryByText(dictionary.checkout.continue)).toBeNull();
  expect(view.queryByText(dictionary.checkout.retry)).toBeNull();
  expect(view.getByText(`${dictionary.checkout.contactCenter} · 0000000000`)).toBeTruthy();
  expect(clientPaymentsService.initNativePayment).not.toHaveBeenCalled();
  view.unmount();
});
