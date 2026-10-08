// SDK public entry eagerly imports its Android-only native component; stub that native boundary in Jest.
jest.mock('react-native-moyasar-sdk/lib/module/specs/RTNSamsungPayNativeComponent.android', () => ({ SAMSUNG_PAY_BUTTON_COMPONENT_NAME: 'RTNSamsungPayButton' }));
jest.mock('react-native/Libraries/Settings/Settings', () => ({ __esModule: true, default: { get: (key: string) => key === 'AppleLanguages' ? ['en'] : 'en' } }));
jest.mock('react-native-webview', () => ({ WebView: 'WebView' }));
import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNativePaymentCheckout } from '../use-native-payment-checkout';
import { clientPaymentsService } from '@/services/client/payments';
import { clientBookingsService } from '@/services/client/bookings';

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

it('keeps a submitted attempt verification-only while the provider outcome is still ambiguous', async () => {
  jest.useFakeTimers();
  jest.mocked(clientPaymentsService.reconcileNativePayment).mockResolvedValue({ paymentId: 'payment', invoiceId: 'invoice', status: 'PENDING', requiresReview: false, canCreatePayment: true });
  const { result, unmount } = renderHook(() => useNativePaymentCheckout(input), { wrapper });
  await waitFor(() => expect(result.current.phase).toBe('ready'));
  await act(async () => { await result.current.onPaymentResult(); });
  for (let i = 0; i < 10; i += 1) await act(async () => { jest.advanceTimersByTime(3000); });
  expect(result.current.canResume).toBe(false);
  await act(() => result.current.retryInitialization());
  expect(clientPaymentsService.initNativePayment).toHaveBeenCalledTimes(1);
  unmount(); jest.useRealTimers();
});

it('allows a new attempt after an authoritative failure', async () => {
  const { result, unmount } = renderHook(() => useNativePaymentCheckout(input), { wrapper });
  await waitFor(() => expect(result.current.phase).toBe('ready'));
  await act(async () => { await result.current.onPaymentResult(); });
  jest.mocked(clientPaymentsService.reconcileNativePayment).mockResolvedValue({ paymentId: 'payment', invoiceId: 'invoice', status: 'FAILED', requiresReview: false });
  await act(() => result.current.reconcile());
  expect(result.current.phase).toBe('failed');
  await act(() => result.current.retryInitialization());
  expect(clientPaymentsService.initNativePayment).toHaveBeenCalledTimes(2);
  unmount();
});

it('verifyPayable is true only when the server says the same attempt can still be paid', async () => {
  jest.mocked(clientPaymentsService.reconcileNativePayment).mockResolvedValue({ paymentId: 'payment', invoiceId: 'invoice', status: 'PENDING', requiresReview: false, canCreatePayment: true });
  const { result, unmount } = renderHook(() => useNativePaymentCheckout(input), { wrapper });
  await waitFor(() => expect(result.current.phase).toBe('ready'));
  let ok = false;
  await act(async () => { ok = await result.current.verifyPayable(); });
  expect(ok).toBe(true);
  jest.mocked(clientPaymentsService.reconcileNativePayment).mockResolvedValue({ paymentId: 'payment', invoiceId: 'invoice', status: 'PENDING', requiresReview: false, unavailableReason: 'BOOKING_EXPIRED' } as Awaited<ReturnType<typeof clientPaymentsService.reconcileNativePayment>>);
  await act(async () => { ok = await result.current.verifyPayable(); });
  expect(ok).toBe(false);
  expect(result.current.phase).toBe('unavailable');
  unmount();
});

it('verifyPayable fails closed on a verification error or a provider-created payment', async () => {
  const { result, unmount } = renderHook(() => useNativePaymentCheckout(input), { wrapper });
  await waitFor(() => expect(result.current.phase).toBe('ready'));
  let ok = true;
  jest.mocked(clientPaymentsService.reconcileNativePayment).mockRejectedValueOnce(new Error('network down'));
  await act(async () => { ok = await result.current.verifyPayable(); });
  expect(ok).toBe(false);
  jest.mocked(clientPaymentsService.reconcileNativePayment).mockResolvedValue({ paymentId: 'payment', invoiceId: 'invoice', status: 'PENDING', requiresReview: false, canCreatePayment: false });
  await act(async () => { ok = await result.current.verifyPayable(); });
  expect(ok).toBe(false);
  unmount();
});

it('verifyPayable waits for a reconciliation that is already running', async () => {
  const { result, unmount } = renderHook(() => useNativePaymentCheckout(input), { wrapper });
  await waitFor(() => expect(result.current.phase).toBe('ready'));
  let finish!: (value: Awaited<ReturnType<typeof clientPaymentsService.reconcileNativePayment>>) => void;
  jest.mocked(clientPaymentsService.reconcileNativePayment).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  jest.mocked(clientPaymentsService.reconcileNativePayment).mockResolvedValue({ paymentId: 'payment', invoiceId: 'invoice', status: 'PENDING', requiresReview: false, unavailableReason: 'BOOKING_EXPIRED' } as Awaited<ReturnType<typeof clientPaymentsService.reconcileNativePayment>>);
  let ok = true; let verifying!: Promise<void>;
  act(() => { void result.current.reconcile(); });
  await act(async () => { verifying = result.current.verifyPayable().then((value) => { ok = value; }); });
  await act(async () => { finish({ paymentId: 'payment', invoiceId: 'invoice', status: 'PENDING', requiresReview: false, canCreatePayment: true }); await verifying; });
  expect(ok).toBe(false);
  expect(clientPaymentsService.reconcileNativePayment).toHaveBeenCalledTimes(2);
  unmount();
});

describe('post-Wallet verification and initialization conflicts', () => {
  const appleInput = { ...input, method: 'APPLE_PAY' as const };
  const pendingOk = { paymentId: 'payment', invoiceId: 'invoice', status: 'PENDING', requiresReview: false, canCreatePayment: true } as const;
  const inProgress = (code: string, paymentId?: string) => ({ response: { data: { code, ...(paymentId ? { paymentId, invoiceId: 'invoice' } : {}) } } });
  async function ready() {
    jest.mocked(clientPaymentsService.reconcileNativePayment).mockResolvedValue(pendingOk);
    const hook = renderHook(() => useNativePaymentCheckout(appleInput), { wrapper });
    await waitFor(() => expect(hook.result.current.phase).toBe('ready'));
    jest.mocked(clientPaymentsService.initNativePayment).mockClear();
    return hook;
  }
  it('authorizes only from a fresh reconciliation and never re-initializes (native/init is throttled)', async () => {
    const { result, unmount } = await ready();
    jest.mocked(clientPaymentsService.reconcileNativePayment).mockClear();
    let ok = false;
    await act(async () => { ok = await result.current.verifyPayable(); });
    expect(ok).toBe(true);
    expect(clientPaymentsService.reconcileNativePayment).toHaveBeenCalledTimes(1);
    expect(clientPaymentsService.initNativePayment).not.toHaveBeenCalled();
    unmount();
  });
  it('runs a check requested during its own check and refuses when that check finds the target closed', async () => {
    const { result, unmount } = await ready();
    let finish!: (value: Awaited<ReturnType<typeof clientPaymentsService.reconcileNativePayment>>) => void;
    jest.mocked(clientPaymentsService.reconcileNativePayment).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    jest.mocked(clientPaymentsService.reconcileNativePayment).mockResolvedValue({ paymentId: 'payment', invoiceId: 'invoice', status: 'PENDING', requiresReview: false, unavailableReason: 'BOOKING_EXPIRED' } as Awaited<ReturnType<typeof clientPaymentsService.reconcileNativePayment>>);
    let verifying!: Promise<boolean>;
    await act(async () => { verifying = result.current.verifyPayable(); });
    await act(async () => { await result.current.reconcile(); }); // arrives while ours is in flight
    let ok = true;
    await act(async () => { finish(pendingOk); ok = await verifying; });
    expect(ok).toBe(false);
    expect(result.current.phase).toBe('unavailable');
    expect(result.current.config).toBeNull();
    unmount();
  });
  it('drains every check requested during verification and refuses after repeated interruptions', async () => {
    const { result, unmount } = await ready();
    let calls = 0;
    jest.mocked(clientPaymentsService.reconcileNativePayment).mockImplementation(async () => {
      calls += 1;
      if (calls <= 2) void result.current.reconcile(); // another request arrives mid-check, twice
      return pendingOk;
    });
    let ok = false;
    await act(async () => { ok = await result.current.verifyPayable(); });
    expect(ok).toBe(true);
    expect(calls).toBe(3);
    unmount();
  });
  it('keeps initialization available when an in-progress conflict arrives with no identity at all', async () => {
    jest.mocked(clientPaymentsService.initNativePayment).mockRejectedValueOnce(inProgress('NATIVE_PAYMENT_IN_PROGRESS'));
    const { result, unmount } = renderHook(() => useNativePaymentCheckout(appleInput), { wrapper });
    await waitFor(() => expect(result.current.phase).toBe('error'));
    expect(result.current.paymentId).toBeNull();
    expect(result.current.canRetryInit).toBe(true);
    jest.mocked(clientPaymentsService.initNativePayment).mockResolvedValueOnce({ paymentId: 'winner', invoiceId: 'invoice', config } as Awaited<ReturnType<typeof clientPaymentsService.initNativePayment>>);
    await act(() => result.current.retryInitialization());
    expect(result.current.phase).toBe('ready');
    expect(result.current.paymentId).toBe('winner');
    unmount();
  });
  it('treats an already-completed invoice without any native payment identity as closed, not as a retryable error', async () => {
    jest.mocked(clientPaymentsService.initNativePayment).mockRejectedValueOnce({ response: { data: { code: 'PAYMENT_ALREADY_COMPLETED' } } });
    const { result, unmount } = renderHook(() => useNativePaymentCheckout(appleInput), { wrapper });
    await waitFor(() => expect(result.current.phase).toBe('unavailable'));
    expect(result.current.unavailableReason).toBe('INVOICE_CLOSED');
    expect(result.current.canRetryInit).toBe(false);
    unmount();
  });
  it.each(['NATIVE_PAYMENT_IN_PROGRESS', 'HOSTED_PAYMENT_IN_PROGRESS'])('%s on retry blocks initialization, keeps its message across checks and keeps verifying', async (code) => {
    const { result, unmount } = await ready();
    jest.mocked(clientPaymentsService.reconcileNativePayment).mockResolvedValue({ ...pendingOk, canCreatePayment: false });
    jest.mocked(clientPaymentsService.initNativePayment).mockRejectedValueOnce(inProgress(code));
    jest.mocked(clientPaymentsService.reconcileNativePayment).mockClear();
    await act(() => result.current.retryInitialization());
    expect(result.current.canRetryInit).toBe(false);
    expect(result.current.canResume).toBe(false);
    expect(result.current.error).toBe('nativePayment.conflict');
    expect(clientPaymentsService.reconcileNativePayment).toHaveBeenCalled();
    await act(() => result.current.reconcile());
    expect(result.current.error).toBe('nativePayment.conflict');
    unmount();
  });
  it('adopts and persists the in-progress identity returned on retry, replacing a stale local one', async () => {
    const { result, unmount } = await ready();
    jest.mocked(clientPaymentsService.initNativePayment).mockRejectedValueOnce(inProgress('NATIVE_PAYMENT_IN_PROGRESS', 'replacement'));
    jest.mocked(clientPaymentsService.reconcileNativePayment).mockResolvedValue({ paymentId: 'replacement', invoiceId: 'invoice', status: 'PENDING', requiresReview: false, canCreatePayment: false });
    await act(() => result.current.retryInitialization());
    expect(result.current.paymentId).toBe('replacement');
    expect(clientPaymentsService.reconcileNativePayment).toHaveBeenLastCalledWith('replacement');
    expect(JSON.parse((await AsyncStorage.getItem('sawaa.native-payment:client:invoice'))!).paymentId).toBe('replacement');
    unmount();
  });
  it('re-enables initialization only when the adopted replacement itself fails', async () => {
    const { result, unmount } = await ready();
    jest.mocked(clientPaymentsService.initNativePayment).mockRejectedValueOnce(inProgress('NATIVE_PAYMENT_IN_PROGRESS', 'replacement'));
    jest.mocked(clientPaymentsService.reconcileNativePayment).mockResolvedValue({ paymentId: 'replacement', invoiceId: 'invoice', status: 'PENDING', requiresReview: false, canCreatePayment: false });
    await act(() => result.current.retryInitialization());
    expect(result.current.canRetryInit).toBe(false);
    jest.mocked(clientPaymentsService.reconcileNativePayment).mockResolvedValue({ paymentId: 'replacement', invoiceId: 'invoice', status: 'FAILED', requiresReview: false });
    await act(() => result.current.reconcile());
    expect(result.current.canRetryInit).toBe(true);
    unmount();
  });
  it('keeps initialization blocked when an identity was given and only the stale attempt reports FAILED', async () => {
    const { result, unmount } = await ready();
    jest.mocked(clientPaymentsService.initNativePayment).mockRejectedValueOnce(inProgress('HOSTED_PAYMENT_IN_PROGRESS', 'replacement'));
    jest.mocked(clientPaymentsService.reconcileNativePayment).mockResolvedValueOnce(pendingOk);
    jest.mocked(clientPaymentsService.reconcileNativePayment).mockResolvedValue({ paymentId: 'replacement', invoiceId: 'invoice', status: 'PENDING', requiresReview: false, canCreatePayment: false });
    await act(() => result.current.retryInitialization());
    await act(() => result.current.reconcile());
    expect(result.current.canRetryInit).toBe(false);
    unmount();
  });
  it('lets a conflict without identity become retryable once the stale attempt is confirmed failed', async () => {
    const { result, unmount } = await ready();
    jest.mocked(clientPaymentsService.initNativePayment).mockRejectedValueOnce(inProgress('HOSTED_PAYMENT_IN_PROGRESS'));
    await act(() => result.current.retryInitialization());
    expect(result.current.canRetryInit).toBe(false);
    jest.mocked(clientPaymentsService.reconcileNativePayment).mockResolvedValue({ paymentId: 'payment', invoiceId: 'invoice', status: 'FAILED', requiresReview: false });
    await act(() => result.current.reconcile());
    expect(result.current.canRetryInit).toBe(true);
    unmount();
  });
});
it('treats a configuration conflict during initialization retry as non-retryable', async () => {
  await AsyncStorage.setItem('sawaa.native-payment:client:invoice', JSON.stringify({ clientId: 'client', invoiceId: 'invoice', bookingId: 'booking', paymentId: 'payment' }));
  jest.mocked(clientPaymentsService.reconcileNativePayment).mockResolvedValue({ paymentId: 'payment', invoiceId: 'invoice', status: 'PENDING', requiresReview: false, canCreatePayment: true });
  const { result, unmount } = renderHook(() => useNativePaymentCheckout(input), { wrapper });
  await waitFor(() => expect(result.current.phase).toBe('pending'));
  expect(result.current.canRetryInit).toBe(true);
  jest.mocked(clientPaymentsService.initNativePayment).mockRejectedValueOnce({ response: { data: { code: 'PAYMENT_CONFIGURATION_CHANGED' } } });
  await act(() => result.current.retryInitialization());
  expect(result.current.phase).toBe('error');
  expect(result.current.error).toBe('nativePayment.conflict');
  expect(result.current.canRetryInit).toBe(false);
  await act(() => result.current.reconcile());
  expect(result.current.canRetryInit).toBe(false);
  unmount();
});
