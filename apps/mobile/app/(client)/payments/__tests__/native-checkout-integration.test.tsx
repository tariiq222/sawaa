jest.mock('react-native-moyasar-sdk/lib/module/specs/RTNSamsungPayNativeComponent.android', () => ({ SAMSUNG_PAY_BUTTON_COMPONENT_NAME: 'RTNSamsungPayButton' }));
jest.mock('react-native/Libraries/Settings/Settings', () => ({ __esModule: true, default: { get: (key: string) => key === 'AppleLanguages' ? ['en'] : 'en' } }));
jest.mock('react-native-webview', () => ({ WebView: 'WebView' }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
import React from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NativeCheckout from '../native-checkout';
import { clientPaymentsService } from '@/services/client/payments';
import { clientBookingsService } from '@/services/client/bookings';
import { clientPackagesService } from '@/services/client/packages';
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@/services/client/payments', () => ({ clientPaymentsService: { initNativePayment: jest.fn(), reconcileNativePayment: jest.fn() } }));
jest.mock('@/services/client/bookings', () => ({ clientBookingsService: { getById: jest.fn() } }));
jest.mock('@/services/client/packages', () => ({ clientPackagesService: { getPurchase: jest.fn() }, getPendingPackagePurchase: jest.fn() }));
let mockParams: Record<string, string>;
let mockAppleAvailable = true;
let mockClientId = 'client';
const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams, useRouter: () => ({ replace: mockReplace, back: mockBack }), Stack: { Screen: () => null } }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/use-redux', () => ({ useAppSelector: () => mockClientId }));
jest.mock('@/theme/ThemeProvider', () => ({ useTheme: () => ({ scheme: 'light' }) }));
jest.mock('@/theme/sawaa/useSawaaColors', () => ({ useSawaaColors: () => ({ ink: { 900: 'black', 500: 'gray' }, teal: { 600: 'teal', 700: 'teal' } }) }));
jest.mock('@/features/payments/native-payment-capabilities', () => ({ useNativePaymentCapabilities: () => ({ enabled: true, isLoading: false, isError: false, applePayAvailable: mockAppleAvailable, refetch: jest.fn() }) }));
// Native bank/card boundary only; the route and checkout lifecycle hook remain real.
jest.mock('@/features/payments/NativePaymentForm', () => ({ NativePaymentForm: ({ method, onResult }: { method: string; onResult: () => void }) => {
  const { Text, Pressable } = require('react-native'); return <Pressable onPress={onResult}><Text>{method}</Text></Pressable>;
} }));
const config = { enabled: true, isLive: false, supportedNetworks: ['mada', 'visa', 'mastercard'], applePay: null,
  publishableKey: 'pk_test_fixture', givenId: 'a0000000-0000-4000-8000-000000000001', amount: 12500, currency: 'SAR', description: 'Invoice' };
function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>{children}</QueryClientProvider>;
}
beforeEach(async () => {
  jest.restoreAllMocks(); jest.clearAllMocks(); await AsyncStorage.clear();
  mockAppleAvailable = true; mockClientId = 'client'; mockParams = { invoiceId: 'invoice', purchaseId: 'purchase' };
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
  const purchase: Awaited<ReturnType<typeof clientPackagesService.getPurchase>> = {
    id: 'purchase', invoiceId: 'invoice', packageId: 'offer', branchId: 'branch',
    packageNameAr: 'باقة استشارات', packageNameEn: 'Counseling package', modelVersion: 'GROUPED_V2',
    status: 'PENDING', subtotalSnapshot: 12500, discountSnapshot: 0, amountPaid: 0,
    refundAmount: 0, paidAt: '', refundedAt: null, createdAt: '2026-10-05T10:00:00.000Z', credits: [],
  };
  jest.mocked(clientPackagesService.getPurchase).mockResolvedValue(purchase);
  jest.mocked(clientBookingsService.getById).mockResolvedValue({ id: 'booking', invoiceId: 'invoice', status: 'deposit_paid' } as Awaited<ReturnType<typeof clientBookingsService.getById>>);
  jest.mocked(clientPaymentsService.initNativePayment).mockResolvedValue({ paymentId: 'payment', invoiceId: 'invoice', config } as Awaited<ReturnType<typeof clientPaymentsService.initNativePayment>>);
  jest.mocked(clientPaymentsService.reconcileNativePayment).mockResolvedValue({ paymentId: 'payment', invoiceId: 'invoice', status: 'PENDING', requiresReview: false, canCreatePayment: false });
});
it.each(['package', 'balance'])('chooses Apple Pay before initializing a %s payment', async (entry) => {
  if (entry === 'balance') mockParams = { invoiceId: 'invoice', bookingId: 'booking' };
  const view = render(<NativeCheckout />, { wrapper });
  await waitFor(() => expect(view.getByText('nativePayment.useApplePay')).toBeTruthy());
  expect(clientPaymentsService.initNativePayment).not.toHaveBeenCalled();
  fireEvent.press(view.getByText('nativePayment.useApplePay'));
  await waitFor(() => expect(view.getByText('APPLE_PAY')).toBeTruthy());
  expect(clientPaymentsService.initNativePayment).toHaveBeenCalledTimes(1);
  expect(clientPaymentsService.initNativePayment).toHaveBeenCalledWith('invoice', 'APPLE_PAY');
  expect(view.queryByText('nativePayment.useCard')).toBeNull();
  view.unmount();
});
it('opens card payment directly when Apple Pay capability is unavailable', async () => {
  mockAppleAvailable = false;
  const view = render(<NativeCheckout />, { wrapper });
  await waitFor(() => expect(view.getByText('ONLINE_CARD')).toBeTruthy());
  expect(clientPaymentsService.initNativePayment).toHaveBeenCalledWith('invoice', 'ONLINE_CARD');
  expect(view.queryByText('nativePayment.useApplePay')).toBeNull(); view.unmount();
});
it('reconciles a restored provider-created payment without method choice or reinitialization', async () => {
  await AsyncStorage.setItem('sawaa.native-payment:client:invoice', JSON.stringify({ clientId: 'client', invoiceId: 'invoice', purchaseId: 'purchase', paymentId: 'payment' }));
  const view = render(<NativeCheckout />, { wrapper });
  await waitFor(() => expect(view.getByText('nativePayment.awaitingVerification')).toBeTruthy());
  expect(view.queryByText('nativePayment.useApplePay')).toBeNull(); expect(view.queryByText('nativePayment.resume')).toBeNull();
  expect(clientPaymentsService.initNativePayment).not.toHaveBeenCalled(); view.unmount();
});
it('resumes a provider-absent reserved UUID with the selected Apple Pay method', async () => {
  await AsyncStorage.setItem('sawaa.native-payment:client:invoice', JSON.stringify({ clientId: 'client', invoiceId: 'invoice', purchaseId: 'purchase', paymentId: 'payment' }));
  jest.mocked(clientPaymentsService.reconcileNativePayment).mockResolvedValue({ paymentId: 'payment', invoiceId: 'invoice', status: 'PENDING', requiresReview: false, canCreatePayment: true });
  const view = render(<NativeCheckout />, { wrapper });
  await waitFor(() => expect(view.getByText('nativePayment.useApplePay')).toBeTruthy());
  fireEvent.press(view.getByText('nativePayment.useApplePay'));
  await waitFor(() => expect(view.getByText('nativePayment.resume')).toBeTruthy());
  fireEvent.press(view.getByText('nativePayment.resume'));
  await waitFor(() => expect(view.getByText('APPLE_PAY')).toBeTruthy());
  expect(clientPaymentsService.initNativePayment).toHaveBeenCalledTimes(1);
  expect(clientPaymentsService.initNativePayment).toHaveBeenCalledWith('invoice', 'APPLE_PAY');
  expect(JSON.parse((await AsyncStorage.getItem('sawaa.native-payment:client:invoice'))!).paymentId).toBe('payment');
  view.unmount();
});
it('presents terminal unavailable instead of payment/resume/check controls after restore', async () => {
  await AsyncStorage.setItem('sawaa.native-payment:client:invoice', JSON.stringify({ clientId: 'client', invoiceId: 'invoice', purchaseId: 'purchase', paymentId: 'payment' }));
  jest.mocked(clientPaymentsService.reconcileNativePayment).mockResolvedValue({ paymentId: 'payment', invoiceId: 'invoice', status: 'PENDING', requiresReview: false, canCreatePayment: false, unavailableReason: 'INVOICE_CLOSED' });
  const view = render(<NativeCheckout />, { wrapper });
  await waitFor(() => expect(view.getByText('nativePayment.INVOICE_CLOSED')).toBeTruthy());
  expect(view.queryByText('nativePayment.useApplePay')).toBeNull(); expect(view.queryByText('nativePayment.resume')).toBeNull();
  expect(view.queryByText('nativePayment.checkAgain')).toBeNull(); expect(clientPaymentsService.initNativePayment).not.toHaveBeenCalled();
  fireEvent.press(view.getByText('nativePayment.back')); expect(mockBack).toHaveBeenCalledTimes(1); view.unmount();
});

// The SDK result is only a signal to verify; it must never decide success.
it('waits automatically after an Apple Pay result without offering a second payment or retry', async () => {
  mockParams.method = 'APPLE_PAY';
  const view = render(<NativeCheckout />, { wrapper });
  await waitFor(() => expect(view.getByText('APPLE_PAY')).toBeTruthy());
  fireEvent.press(view.getByText('APPLE_PAY'));
  await waitFor(() => expect(clientPaymentsService.reconcileNativePayment).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(view.getByText('nativePayment.processing')).toBeTruthy());
  expect(view.queryByText('nativePayment.checkAgain')).toBeNull();
  expect(view.queryByText('nativePayment.retry')).toBeNull();
  expect(view.queryByText('nativePayment.resume')).toBeNull();
  expect(view.queryByText('APPLE_PAY')).toBeNull();
  expect(mockReplace).not.toHaveBeenCalled();
  expect(clientPaymentsService.initNativePayment).toHaveBeenCalledTimes(1);
  view.unmount();
});
it('does not lose the SDK result when a foreground verification is already in flight', async () => {
  let foreground!: (state: AppStateStatus) => void;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
    foreground = callback; return { remove: jest.fn() };
  });
  mockParams = { invoiceId: 'invoice', bookingId: 'booking', method: 'APPLE_PAY' };
  let finish!: (value: Awaited<ReturnType<typeof clientPaymentsService.reconcileNativePayment>>) => void;
  jest.mocked(clientPaymentsService.reconcileNativePayment).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }))
    .mockResolvedValueOnce({ paymentId: 'payment', invoiceId: 'invoice', status: 'COMPLETED', requiresReview: false });
  const view = render(<NativeCheckout />, { wrapper });
  await waitFor(() => expect(view.getByText('APPLE_PAY')).toBeTruthy());
  act(() => foreground('active'));
  // The bank view remains usable until its own result arrives.
  fireEvent.press(view.getByText('APPLE_PAY'));
  await act(async () => { finish({ paymentId: 'payment', invoiceId: 'invoice', status: 'PENDING', requiresReview: false }); });
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/(client)/booking/success' })));
  expect(clientPaymentsService.reconcileNativePayment).toHaveBeenCalledTimes(2);
  expect(clientPaymentsService.initNativePayment).toHaveBeenCalledTimes(1);
  view.unmount();
});
