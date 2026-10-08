// SDK public entry eagerly imports its Android-only native component; stub that native boundary in Jest.
jest.mock('react-native-moyasar-sdk/lib/module/specs/RTNSamsungPayNativeComponent.android', () => ({ SAMSUNG_PAY_BUTTON_COMPONENT_NAME: 'RTNSamsungPayButton' }));
jest.mock('react-native/Libraries/Settings/Settings', () => ({ __esModule: true, default: { get: (key: string) => key === 'AppleLanguages' ? ['en'] : 'en' } }));
jest.mock('react-native-webview', () => ({ WebView: 'WebView' }));
import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppState, type AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNativePaymentCheckout } from '../use-native-payment-checkout';
import { clientPaymentsService } from '@/services/client/payments';
import { clientBookingsService } from '@/services/client/bookings';
import { clientPackagesService } from '@/services/client/packages';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@/services/client/payments', () => ({ clientPaymentsService: { initNativePayment: jest.fn(), reconcileNativePayment: jest.fn() } }));
jest.mock('@/services/client/bookings', () => ({ clientBookingsService: { getById: jest.fn() } }));
jest.mock('@/services/client/packages', () => ({ clientPackagesService: { getPurchase: jest.fn() } }));
const config = { enabled: true, isLive: false, supportedNetworks: ['mada', 'visa', 'mastercard'], applePay: null,
  publishableKey: 'pk_test_fixture', givenId: 'a0000000-0000-4000-8000-000000000001', amount: 12500, currency: 'SAR', description: 'Invoice' };
const input = { clientId: 'client', invoiceId: 'invoice', bookingId: 'booking', method: 'ONLINE_CARD' as const };
function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>{children}</QueryClientProvider>;
}
beforeEach(async () => {
  jest.restoreAllMocks(); jest.clearAllMocks(); await AsyncStorage.clear();
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
  jest.mocked(clientBookingsService.getById).mockResolvedValue({ id: 'booking', invoiceId: 'invoice', status: 'pending' } as Awaited<ReturnType<typeof clientBookingsService.getById>>);
  jest.mocked(clientPaymentsService.initNativePayment).mockResolvedValue({ paymentId: 'payment', invoiceId: 'invoice', config } as Awaited<ReturnType<typeof clientPaymentsService.initNativePayment>>);
  jest.mocked(clientPaymentsService.reconcileNativePayment).mockResolvedValue({ paymentId: 'payment', invoiceId: 'invoice', status: 'PENDING', requiresReview: false });
});
it('persists identity before presenting form, then ignores SDK success and waits for server', async () => {
  const { result, unmount } = renderHook(() => useNativePaymentCheckout(input), { wrapper });
  await waitFor(() => expect(result.current.phase).toBe('ready'));
  const stored = JSON.stringify(await AsyncStorage.multiGet(await AsyncStorage.getAllKeys()));
  expect(stored).toContain('payment'); expect(stored).not.toContain('pk_test');
  await act(() => result.current.reconcile());
  expect(result.current.phase).toBe('pending'); expect(result.current.config).toBe(config);
  expect(clientPaymentsService.reconcileNativePayment).toHaveBeenCalledWith('payment'); unmount();
});
it('uses server completion even after a failed SDK callback, and confirms the booking', async () => {
  const { result, unmount } = renderHook(() => useNativePaymentCheckout(input), { wrapper });
  await waitFor(() => expect(result.current.phase).toBe('ready'));
  jest.mocked(clientPaymentsService.reconcileNativePayment).mockResolvedValue({ paymentId: 'payment', invoiceId: 'invoice', status: 'COMPLETED', requiresReview: false });
  jest.mocked(clientBookingsService.getById).mockResolvedValue({ id: 'booking', invoiceId: 'invoice', status: 'confirmed' } as Awaited<ReturnType<typeof clientBookingsService.getById>>);
  await act(() => result.current.reconcile());
  expect(result.current.phase).toBe('completed'); unmount();
});
it('never marks an unconfirmed booking or review-required payment successful', async () => {
  const { result, unmount } = renderHook(() => useNativePaymentCheckout(input), { wrapper });
  await waitFor(() => expect(result.current.phase).toBe('ready'));
  jest.mocked(clientPaymentsService.reconcileNativePayment).mockResolvedValue({ paymentId: 'payment', invoiceId: 'invoice', status: 'COMPLETED', requiresReview: false });
  await act(() => result.current.reconcile()); expect(result.current.phase).toBe('processing');
  expect(result.current.config).toBeNull(); expect(result.current.canResume).toBe(false);
  jest.mocked(clientPaymentsService.reconcileNativePayment).mockResolvedValue({ paymentId: 'payment', invoiceId: 'invoice', status: 'COMPLETED', requiresReview: true });
  await act(() => result.current.reconcile()); expect(result.current.phase).toBe('review'); unmount();
});
it('can reconcile on foreground without an SDK callback', async () => {
  let foreground: ((state: AppStateStatus) => void) | undefined;
  const listener = jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => { foreground = callback; return { remove: jest.fn() }; });
  const { result, unmount } = renderHook(() => useNativePaymentCheckout(input), { wrapper });
  await waitFor(() => expect(result.current.phase).toBe('ready'));
  await act(async () => { foreground?.('active'); });
  expect(result.current.phase).toBe('pending'); unmount(); listener.mockRestore();
});
it('rejects a route that does not belong to the invoice before initializing', async () => {
  jest.mocked(clientBookingsService.getById).mockResolvedValue({ id: 'booking', invoiceId: 'other', status: 'pending' } as Awaited<ReturnType<typeof clientBookingsService.getById>>);
  const { result, unmount } = renderHook(() => useNativePaymentCheckout(input), { wrapper });
  await waitFor(() => expect(result.current.phase).toBe('error'));
  expect(clientPaymentsService.initNativePayment).not.toHaveBeenCalled(); unmount();
});
it('ignores an old client initialization response after account switching', async () => {
  let finish!: (value: Awaited<ReturnType<typeof clientPaymentsService.initNativePayment>>) => void;
  jest.mocked(clientPaymentsService.initNativePayment).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
  const { result, rerender, unmount } = renderHook(({ clientId }: { clientId: string }) => useNativePaymentCheckout({ ...input, clientId }), { wrapper, initialProps: { clientId: 'client' } });
  await waitFor(() => expect(clientPaymentsService.initNativePayment).toHaveBeenCalledTimes(1));
  rerender({ clientId: '' });
  await act(async () => { finish({ paymentId: 'payment', invoiceId: 'invoice', config } as Awaited<ReturnType<typeof clientPaymentsService.initNativePayment>>); });
  expect(result.current.config).toBeNull(); expect(await AsyncStorage.getAllKeys()).toEqual([]); unmount();
});

it('permits an explicit new attempt only after the server declares the old attempt failed', async () => {
  const { result, unmount } = renderHook(() => useNativePaymentCheckout(input), { wrapper });
  await waitFor(() => expect(result.current.phase).toBe('ready'));
  jest.mocked(clientPaymentsService.reconcileNativePayment).mockResolvedValue({ paymentId: 'payment', invoiceId: 'invoice', status: 'FAILED', requiresReview: false });
  await act(() => result.current.reconcile());
  expect(result.current.phase).toBe('failed');
  jest.mocked(clientPaymentsService.initNativePayment).mockResolvedValue({ paymentId: 'payment-next', invoiceId: 'invoice', config: { ...config, givenId: 'a0000000-0000-4000-8000-000000000002' } } as Awaited<ReturnType<typeof clientPaymentsService.initNativePayment>>);
  await act(() => result.current.retryInitialization());
  expect(result.current.phase).toBe('ready'); expect(result.current.paymentId).toBe('payment-next'); unmount();
});

it('does not let an old SDK callback reconcile the new client checkout', async () => {
  const { result, rerender, unmount } = renderHook(({ clientId }: { clientId: string }) => useNativePaymentCheckout({ ...input, clientId }), { wrapper, initialProps: { clientId: 'client' } });
  await waitFor(() => expect(result.current.phase).toBe('ready'));
  const oldCallback = result.current.reconcile;
  rerender({ clientId: 'new-client' });
  await waitFor(() => expect(clientPaymentsService.initNativePayment).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(result.current.phase).toBe('ready'));
  await act(() => oldCallback());
  expect(clientPaymentsService.reconcileNativePayment).not.toHaveBeenCalled(); unmount();
});
it('restores the stored identity and reconciles before offering to resume the same invoice', async () => {
  jest.mocked(clientPaymentsService.reconcileNativePayment).mockResolvedValue({ paymentId: 'payment', invoiceId: 'invoice', status: 'PENDING', requiresReview: false, canCreatePayment: true });
  await AsyncStorage.setItem('sawaa.native-payment:client:invoice', JSON.stringify({ clientId: 'client', invoiceId: 'invoice', bookingId: 'booking', paymentId: 'payment' }));
  const { result, unmount } = renderHook(() => useNativePaymentCheckout(input), { wrapper });
  await waitFor(() => expect(result.current.phase).toBe('pending'));
  expect(clientPaymentsService.initNativePayment).not.toHaveBeenCalled();
  expect(clientPaymentsService.reconcileNativePayment).toHaveBeenCalledWith('payment');
  await act(() => result.current.retryInitialization());
  expect(result.current.phase).toBe('ready'); expect(result.current.paymentId).toBe('payment'); unmount();
});
it('rejects a replacement identity while the original is still pending', async () => {
  jest.mocked(clientPaymentsService.reconcileNativePayment).mockResolvedValue({ paymentId: 'payment', invoiceId: 'invoice', status: 'PENDING', requiresReview: false, canCreatePayment: true });
  const { result, unmount } = renderHook(() => useNativePaymentCheckout(input), { wrapper });
  await waitFor(() => expect(result.current.phase).toBe('ready'));
  await act(() => result.current.reconcile());
  jest.mocked(clientPaymentsService.initNativePayment).mockResolvedValue({ paymentId: 'unexpected', invoiceId: 'invoice', config } as Awaited<ReturnType<typeof clientPaymentsService.initNativePayment>>);
  await act(() => result.current.retryInitialization());
  expect(result.current.phase).toBe('error'); expect(result.current.config).toBeNull();
  expect(result.current.paymentId).toBe('payment'); unmount();
});
it('bounds pending polling and never reinitializes automatically', async () => {
  jest.useFakeTimers();
  const { result, unmount } = renderHook(() => useNativePaymentCheckout(input), { wrapper });
  await waitFor(() => expect(result.current.phase).toBe('ready'));
  await act(() => result.current.reconcile());
  for (let i = 0; i < 10; i += 1) await act(async () => { jest.advanceTimersByTime(3000); });
  expect(clientPaymentsService.reconcileNativePayment).toHaveBeenCalledTimes(7);
  expect(clientPaymentsService.initNativePayment).toHaveBeenCalledTimes(1);
  expect(result.current.phase).toBe('pending');
  unmount(); jest.useRealTimers();
});

it('reconciles the owner-bound completed conflict identity and honors review instead of retrying payment', async () => {
  jest.mocked(clientPaymentsService.initNativePayment).mockRejectedValueOnce({ response: { data: { code: 'PAYMENT_ALREADY_COMPLETED', paymentId: 'payment', invoiceId: 'invoice' } } });
  jest.mocked(clientPaymentsService.reconcileNativePayment).mockResolvedValue({ paymentId: 'payment', invoiceId: 'invoice', status: 'COMPLETED', requiresReview: true });
  const { result, unmount } = renderHook(() => useNativePaymentCheckout(input), { wrapper });
  await waitFor(() => expect(result.current.phase).toBe('review'));
  expect(clientPaymentsService.reconcileNativePayment).toHaveBeenCalledWith('payment');
  expect(clientPaymentsService.initNativePayment).toHaveBeenCalledTimes(1); unmount();
});


it.each(['ACTIVE', 'COMPLETED'] as const)('restores a paid %s package as operational success without a new initialization', async (status) => {
  await AsyncStorage.setItem('sawaa.native-payment:client:invoice', JSON.stringify({ clientId: 'client', invoiceId: 'invoice', purchaseId: 'purchase', paymentId: 'payment' }));
  jest.mocked(clientPackagesService.getPurchase).mockResolvedValue({ id: 'purchase', invoiceId: 'invoice', status } as Awaited<ReturnType<typeof clientPackagesService.getPurchase>>);
  jest.mocked(clientPaymentsService.reconcileNativePayment).mockResolvedValue({ paymentId: 'payment', invoiceId: 'invoice', status: 'COMPLETED', requiresReview: false });
  const { result, unmount } = renderHook(() => useNativePaymentCheckout({ clientId: 'client', invoiceId: 'invoice', purchaseId: 'purchase', method: 'ONLINE_CARD' }), { wrapper });
  try {
    await waitFor(() => expect(result.current.phase).toBe('completed'));
    expect(await AsyncStorage.getItem('sawaa.native-payment:client:invoice')).toBeNull();
    expect(clientPaymentsService.initNativePayment).not.toHaveBeenCalled();
    expect(clientPaymentsService.reconcileNativePayment).toHaveBeenCalledWith('payment');
  } finally { unmount(); }
});
it('preserves review handling even when a restored package has completed', async () => {
  await AsyncStorage.setItem('sawaa.native-payment:client:invoice', JSON.stringify({ clientId: 'client', invoiceId: 'invoice', purchaseId: 'purchase', paymentId: 'payment' }));
  jest.mocked(clientPackagesService.getPurchase).mockResolvedValue({ id: 'purchase', invoiceId: 'invoice', status: 'COMPLETED' } as Awaited<ReturnType<typeof clientPackagesService.getPurchase>>);
  jest.mocked(clientPaymentsService.reconcileNativePayment).mockResolvedValue({ paymentId: 'payment', invoiceId: 'invoice', status: 'COMPLETED', requiresReview: true });
  const { result, unmount } = renderHook(() => useNativePaymentCheckout({ clientId: 'client', invoiceId: 'invoice', purchaseId: 'purchase', method: 'ONLINE_CARD' }), { wrapper });
  try {
    await waitFor(() => expect(result.current.phase).toBe('review'));
    expect(await AsyncStorage.getItem('sawaa.native-payment:client:invoice')).not.toBeNull();
    expect(clientPaymentsService.initNativePayment).not.toHaveBeenCalled();
  } finally { unmount(); }
});

it('keeps a refunded restored package in review and preserves its identity', async () => {
  await AsyncStorage.setItem('sawaa.native-payment:client:invoice', JSON.stringify({ clientId: 'client', invoiceId: 'invoice', purchaseId: 'purchase', paymentId: 'payment' }));
  jest.mocked(clientPackagesService.getPurchase).mockResolvedValue({ id: 'purchase', invoiceId: 'invoice', status: 'REFUNDED' } as Awaited<ReturnType<typeof clientPackagesService.getPurchase>>);
  jest.mocked(clientPaymentsService.reconcileNativePayment).mockResolvedValue({ paymentId: 'payment', invoiceId: 'invoice', status: 'REFUNDED', requiresReview: false });
  const { result, unmount } = renderHook(() => useNativePaymentCheckout({ clientId: 'client', invoiceId: 'invoice', purchaseId: 'purchase', method: 'ONLINE_CARD' }), { wrapper });
  try {
    await waitFor(() => expect(result.current.phase).toBe('review'));
    expect(await AsyncStorage.getItem('sawaa.native-payment:client:invoice')).not.toBeNull();
    expect(clientPaymentsService.initNativePayment).not.toHaveBeenCalled();
  } finally { unmount(); }
});

it('retains the live SDK instance configuration throughout foreground verification, pending and temporary errors', async () => {
  let foreground: ((state: AppStateStatus) => void) | undefined;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => { foreground = callback; return { remove: jest.fn() }; });
  const { result, unmount } = renderHook(() => useNativePaymentCheckout(input), { wrapper });
  await waitFor(() => expect(result.current.phase).toBe('ready'));
  let finish!: (value: Awaited<ReturnType<typeof clientPaymentsService.reconcileNativePayment>>) => void;
  jest.mocked(clientPaymentsService.reconcileNativePayment).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  act(() => foreground?.('active'));
  expect(result.current.phase).toBe('checking');
  expect(result.current.config).toBe(config);
  await act(async () => { finish({ paymentId: 'payment', invoiceId: 'invoice', status: 'PENDING', requiresReview: false }); });
  expect(result.current.config).toBe(config);
  jest.mocked(clientPaymentsService.reconcileNativePayment).mockRejectedValueOnce(new Error('Temporary network loss'));
  await act(() => result.current.reconcile());
  expect(result.current.phase).toBe('error'); expect(result.current.config).toBe(config);
  expect(clientPaymentsService.initNativePayment).toHaveBeenCalledTimes(1);
  jest.mocked(clientPaymentsService.reconcileNativePayment).mockResolvedValueOnce({ paymentId: 'payment', invoiceId: 'invoice', status: 'FAILED', requiresReview: false });
  await act(() => result.current.reconcile());
  expect(result.current.config).toBeNull();
  unmount();
});
it('keeps a provider-created payment verification-only after a cold start', async () => {
  await AsyncStorage.setItem('sawaa.native-payment:client:invoice', JSON.stringify({ clientId: 'client', invoiceId: 'invoice', bookingId: 'booking', paymentId: 'payment' }));
  const { result, unmount } = renderHook(() => useNativePaymentCheckout(input), { wrapper });
  await waitFor(() => expect(result.current.phase).toBe('pending'));
  expect(result.current.config).toBeNull(); expect(result.current.canResume).toBe(false);
  expect(clientPaymentsService.initNativePayment).not.toHaveBeenCalled();
  unmount();
});


it('waits for method selection before initializing a fresh eligible checkout', async () => {
  const { result, rerender, unmount } = renderHook(({ method }: { method: 'APPLE_PAY' | undefined }) => useNativePaymentCheckout({ ...input, method }), { wrapper, initialProps: { method: undefined } });
  await waitFor(() => expect(result.current.phase).toBe('choosing'));
  expect(clientPaymentsService.initNativePayment).not.toHaveBeenCalled();
  rerender({ method: 'APPLE_PAY' });
  await waitFor(() => expect(result.current.phase).toBe('ready'));
  expect(clientPaymentsService.initNativePayment).toHaveBeenCalledWith('invoice', 'APPLE_PAY');
  unmount();
});
it('restores a provider-created pending attempt without requiring method selection or allowing recreation', async () => {
  await AsyncStorage.setItem('sawaa.native-payment:client:invoice', JSON.stringify({ clientId: 'client', invoiceId: 'invoice', bookingId: 'booking', paymentId: 'payment' }));
  const { result, unmount } = renderHook(() => useNativePaymentCheckout({ ...input, method: undefined }), { wrapper });
  await waitFor(() => expect(result.current.phase).toBe('pending'));
  await act(() => result.current.retryInitialization());
  expect(result.current.config).toBeNull(); expect(result.current.canResume).toBe(false);
  expect(clientPaymentsService.initNativePayment).not.toHaveBeenCalled();
  unmount();
});
it.each(['BOOKING_EXPIRED', 'BOOKING_CLOSED', 'INVOICE_CLOSED'] as const)('stops form, resume, polling and foreground checks for %s', async (unavailableReason) => {
  jest.useFakeTimers();
  let foreground: ((state: AppStateStatus) => void) | undefined;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => { foreground = callback; return { remove: jest.fn() }; });
  const { result, unmount } = renderHook(() => useNativePaymentCheckout(input), { wrapper });
  await waitFor(() => expect(result.current.phase).toBe('ready'));
  jest.mocked(clientPaymentsService.reconcileNativePayment).mockResolvedValue({ paymentId: 'payment', invoiceId: 'invoice', status: 'PENDING', requiresReview: false, canCreatePayment: false, unavailableReason });
  await act(() => result.current.reconcile());
  expect(result.current.phase).toBe('unavailable'); expect(result.current.config).toBeNull(); expect(result.current.canResume).toBe(false);
  expect(result.current.unavailableReason).toBe(unavailableReason);
  await act(async () => { jest.advanceTimersByTime(30000); foreground?.('active'); });
  await act(() => result.current.retryInitialization()); await act(() => result.current.reconcile());
  expect(clientPaymentsService.reconcileNativePayment).toHaveBeenCalledTimes(1);
  expect(clientPaymentsService.initNativePayment).toHaveBeenCalledTimes(1);
  unmount(); jest.useRealTimers();
});

it.each(['BOOKING_EXPIRED', 'BOOKING_CLOSED', 'INVOICE_CLOSED'])('treats initialization rejection %s as terminal unavailable', async (code) => {
  jest.mocked(clientPaymentsService.initNativePayment).mockRejectedValueOnce({ response: { data: { code } } });
  const { result, unmount } = renderHook(() => useNativePaymentCheckout(input), { wrapper });
  await waitFor(() => expect(result.current.phase).toBe('unavailable'));
  expect(result.current.unavailableReason).toBe(code); expect(result.current.config).toBeNull(); expect(result.current.canResume).toBe(false);
  await act(() => result.current.retryInitialization());
  expect(clientPaymentsService.initNativePayment).toHaveBeenCalledTimes(1); unmount();
});

it.each(['pending', 'network'] as const)('bounds automatic verification after an SDK result with %s responses', async (response) => {
  jest.useFakeTimers();
  const { result, unmount } = renderHook(() => useNativePaymentCheckout(input), { wrapper });
  try {
    await waitFor(() => expect(result.current.phase).toBe('ready'));
    if (response === 'network') jest.mocked(clientPaymentsService.reconcileNativePayment).mockRejectedValue(new Error('Offline'));
    await act(() => result.current.onPaymentResult());
    expect(result.current.phase).toBe('processing'); expect(result.current.config).toBeNull();
    await act(() => result.current.retryInitialization());
    for (let i = 0; i < 10; i += 1) await act(async () => { jest.advanceTimersByTime(3000); });
    expect(clientPaymentsService.reconcileNativePayment).toHaveBeenCalledTimes(7);
    expect(clientPaymentsService.initNativePayment).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toBe(response === 'network' ? 'error' : 'pending');
    expect(result.current.config).toBeNull(); expect(result.current.canResume).toBe(false);
  } finally { unmount(); jest.useRealTimers(); }
});
it('offers a new attempt after an SDK result only when the server declares failure', async () => {
  const { result, unmount } = renderHook(() => useNativePaymentCheckout(input), { wrapper });
  await waitFor(() => expect(result.current.phase).toBe('ready'));
  jest.mocked(clientPaymentsService.reconcileNativePayment).mockResolvedValue({ paymentId: 'payment', invoiceId: 'invoice', status: 'FAILED', requiresReview: false });
  await act(() => result.current.onPaymentResult());
  expect(result.current.phase).toBe('failed'); expect(result.current.config).toBeNull();
  expect(clientPaymentsService.initNativePayment).toHaveBeenCalledTimes(1);
  await act(() => result.current.retryInitialization());
  expect(result.current.phase).toBe('ready'); expect(clientPaymentsService.initNativePayment).toHaveBeenCalledTimes(2);
  unmount();
});
it('waits for booking confirmation after capture and never initializes another payment', async () => {
  jest.useFakeTimers();
  const { result, unmount } = renderHook(() => useNativePaymentCheckout(input), { wrapper });
  try {
    await waitFor(() => expect(result.current.phase).toBe('ready'));
    jest.mocked(clientPaymentsService.reconcileNativePayment).mockResolvedValue({ paymentId: 'payment', invoiceId: 'invoice', status: 'COMPLETED', requiresReview: false });
    await act(() => result.current.onPaymentResult());
    expect(result.current.phase).toBe('processing'); expect(result.current.canResume).toBe(false);
    await act(() => result.current.retryInitialization());
    jest.mocked(clientBookingsService.getById).mockResolvedValue({ id: 'booking', invoiceId: 'invoice', status: 'confirmed' } as Awaited<ReturnType<typeof clientBookingsService.getById>>);
    await act(async () => { jest.advanceTimersByTime(3000); });
    expect(result.current.phase).toBe('completed'); expect(await AsyncStorage.getItem('sawaa.native-payment:client:invoice')).toBeNull();
    expect(clientPaymentsService.initNativePayment).toHaveBeenCalledTimes(1);
  } finally { unmount(); jest.useRealTimers(); }
});

it.each(['payment', 'payment-next'])('ignores the old SDK callback after explicit retry initializes %s', async (nextId) => {
  const { result, unmount } = renderHook(() => useNativePaymentCheckout(input), { wrapper });
  await waitFor(() => expect(result.current.phase).toBe('ready'));
  const oldResult = result.current.onPaymentResult;
  jest.mocked(clientPaymentsService.reconcileNativePayment).mockResolvedValue({ paymentId: 'payment', invoiceId: 'invoice', status: 'FAILED', requiresReview: false });
  await act(() => result.current.reconcile());
  jest.mocked(clientPaymentsService.initNativePayment).mockResolvedValue({ paymentId: nextId, invoiceId: 'invoice', config } as Awaited<ReturnType<typeof clientPaymentsService.initNativePayment>>);
  await act(() => result.current.retryInitialization());
  await act(() => oldResult());
  expect(result.current.phase).toBe('ready'); expect(result.current.config).toBe(config);
  expect(clientPaymentsService.reconcileNativePayment).toHaveBeenCalledTimes(1);
  unmount();
});

it('ignores an old SDK result while the new attempt identity is being persisted', async () => {
  const { result, unmount } = renderHook(() => useNativePaymentCheckout(input), { wrapper });
  await waitFor(() => expect(result.current.phase).toBe('ready'));
  const oldResult = result.current.onPaymentResult;
  jest.mocked(clientPaymentsService.reconcileNativePayment).mockResolvedValue({ paymentId: 'payment', invoiceId: 'invoice', status: 'FAILED', requiresReview: false });
  await act(() => result.current.reconcile());
  let finish!: () => void;
  jest.spyOn(AsyncStorage, 'setItem').mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));
  let retry!: Promise<void>;
  act(() => { retry = result.current.retryInitialization(); });
  await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenCalledTimes(2));
  await act(() => oldResult());
  expect(result.current.phase).toBe('loading');
  await act(async () => { finish(); await retry; });
  expect(result.current.phase).toBe('ready'); expect(result.current.config).toBe(config);
  jest.mocked(clientPaymentsService.reconcileNativePayment).mockResolvedValue({ paymentId: 'payment', invoiceId: 'invoice', status: 'PENDING', requiresReview: false });
  await act(() => result.current.onPaymentResult());
  expect(clientPaymentsService.reconcileNativePayment).toHaveBeenCalledTimes(2);
  expect(result.current.phase).toBe('processing'); expect(result.current.config).toBeNull();
  unmount();
});

it('does not offer initialization retry after a submitted result when verification keeps failing', async () => {
  jest.useFakeTimers();
  const { result, unmount } = renderHook(() => useNativePaymentCheckout(input), { wrapper });
  await waitFor(() => expect(result.current.phase).toBe('ready'));
  expect(result.current.canRetryInit).toBe(true);
  jest.mocked(clientPaymentsService.reconcileNativePayment).mockRejectedValue(new Error('network down'));
  await act(async () => { await result.current.onPaymentResult(); });
  for (let i = 0; i < 10; i += 1) await act(async () => { jest.advanceTimersByTime(3000); });
  await act(() => result.current.reconcile());
  expect(result.current.phase).toBe('error');
  expect(result.current.canRetryInit).toBe(false);
  unmount(); jest.useRealTimers();
});
