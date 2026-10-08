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

it('allows a new attempt and marks the stored identity failed after an authoritative failure', async () => {
  const { result, unmount } = renderHook(() => useNativePaymentCheckout(input), { wrapper });
  await waitFor(() => expect(result.current.phase).toBe('ready'));
  await act(async () => { await result.current.onPaymentResult(); });
  jest.mocked(clientPaymentsService.reconcileNativePayment).mockResolvedValue({ paymentId: 'payment', invoiceId: 'invoice', status: 'FAILED', requiresReview: false });
  await act(() => result.current.reconcile());
  expect(result.current.phase).toBe('failed');
  expect(JSON.parse((await AsyncStorage.getItem('sawaa.native-payment:client:invoice'))!).failed).toBe(true);
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

const realNow = Date.now();
describe('verifyPayable provider configuration gate', () => {
  afterEach(() => { jest.spyOn(Date, 'now').mockRestore(); });
  const appleInput = { ...input, method: 'APPLE_PAY' as const };
  const pendingOk = { paymentId: 'payment', invoiceId: 'invoice', status: 'PENDING', requiresReview: false, canCreatePayment: true } as const;
  async function ready() {
    jest.mocked(clientPaymentsService.reconcileNativePayment).mockResolvedValue(pendingOk);
    const hook = renderHook(() => useNativePaymentCheckout(appleInput), { wrapper });
    await waitFor(() => expect(hook.result.current.phase).toBe('ready'));
    jest.mocked(clientPaymentsService.initNativePayment).mockClear();
    // Past the freshness window the post-Wallet check re-runs the throttled initialization.
    jest.spyOn(Date, 'now').mockReturnValue(realNow + 60_000);
    return hook;
  }
  it('re-runs initialization and accepts the unchanged configuration for the same attempt', async () => {
    const { result, unmount } = await ready();
    let ok = false;
    await act(async () => { ok = await result.current.verifyPayable(); });
    expect(ok).toBe(true);
    expect(clientPaymentsService.initNativePayment).toHaveBeenCalledWith('invoice', 'APPLE_PAY');
    unmount();
  });
  it('fails closed when the provider configuration was rotated while Wallet was open', async () => {
    const { result, unmount } = await ready();
    jest.mocked(clientPaymentsService.initNativePayment).mockResolvedValue({ paymentId: 'payment', invoiceId: 'invoice', config: { ...config, publishableKey: 'pk_test_rotated' } } as Awaited<ReturnType<typeof clientPaymentsService.initNativePayment>>);
    let ok = true;
    await act(async () => { ok = await result.current.verifyPayable(); });
    expect(ok).toBe(false);
    expect(result.current.phase).toBe('error');
    expect(result.current.config).toBeNull();
    unmount();
  });
  it('fails closed when the Apple Pay merchant configuration changed', async () => {
    const { result, unmount } = await ready();
    jest.mocked(clientPaymentsService.initNativePayment).mockResolvedValue({ paymentId: 'payment', invoiceId: 'invoice', config: { ...config, applePay: { merchantId: 'merchant.other', label: 'Other', countryCode: 'SA' } } } as Awaited<ReturnType<typeof clientPaymentsService.initNativePayment>>);
    let ok = true;
    await act(async () => { ok = await result.current.verifyPayable(); });
    expect(ok).toBe(false);
    unmount();
  });
  it('applies terminal init results after Wallet: an expired booking becomes unavailable', async () => {
    const { result, unmount } = await ready();
    jest.mocked(clientPaymentsService.initNativePayment).mockRejectedValueOnce({ response: { data: { code: 'BOOKING_EXPIRED' } } });
    let ok = true;
    await act(async () => { ok = await result.current.verifyPayable(); });
    expect(ok).toBe(false);
    expect(result.current.phase).toBe('unavailable');
    expect(result.current.unavailableReason).toBe('BOOKING_EXPIRED');
    unmount();
  });
  it('adopts the completed payment identity when another flow completed it during verification', async () => {
    const { result, unmount } = await ready();
    jest.mocked(clientPaymentsService.initNativePayment).mockRejectedValueOnce({ response: { data: { code: 'PAYMENT_ALREADY_COMPLETED', paymentId: 'completed-payment', invoiceId: 'invoice' } } });
    jest.mocked(clientPaymentsService.reconcileNativePayment).mockResolvedValueOnce(pendingOk);
    jest.mocked(clientPaymentsService.reconcileNativePayment).mockResolvedValue({ paymentId: 'completed-payment', invoiceId: 'invoice', status: 'COMPLETED', requiresReview: false });
    jest.mocked(clientBookingsService.getById).mockResolvedValue({ id: 'booking', invoiceId: 'invoice', status: 'confirmed' } as Awaited<ReturnType<typeof clientBookingsService.getById>>);
    let ok = true;
    await act(async () => { ok = await result.current.verifyPayable(); });
    expect(ok).toBe(false);
    expect(clientPaymentsService.reconcileNativePayment).toHaveBeenLastCalledWith('completed-payment');
    expect(result.current.phase).toBe('completed');
    unmount();
  });
  it('adopts a legitimate replacement attempt instead of treating it as a configuration conflict', async () => {
    const { result, unmount } = await ready();
    const replacement = { ...config, givenId: 'b0000000-0000-4000-8000-000000000002' };
    jest.mocked(clientPaymentsService.initNativePayment).mockResolvedValue({ paymentId: 'replacement', invoiceId: 'invoice', config: replacement } as Awaited<ReturnType<typeof clientPaymentsService.initNativePayment>>);
    let ok = true;
    await act(async () => { ok = await result.current.verifyPayable(); });
    expect(ok).toBe(false);
    expect(result.current.phase).toBe('ready');
    expect(result.current.paymentId).toBe('replacement');
    expect(result.current.config).toEqual(replacement);
    expect(result.current.canRetryInit).toBe(true);
    expect(JSON.parse((await AsyncStorage.getItem('sawaa.native-payment:client:invoice'))!).paymentId).toBe('replacement');
    unmount();
  });
  it('does not run another reconciliation in parallel while the post-Wallet initialization is in flight', async () => {
    const { result, unmount } = await ready();
    let finish!: (value: Awaited<ReturnType<typeof clientPaymentsService.initNativePayment>>) => void;
    jest.mocked(clientPaymentsService.initNativePayment).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    jest.mocked(clientPaymentsService.reconcileNativePayment).mockClear();
    let verifying!: Promise<boolean>;
    await act(async () => { verifying = result.current.verifyPayable(); });
    // A foreground/poll reconciliation arriving now must not overlap the authoritative check.
    await act(async () => { await result.current.reconcile(); });
    expect(clientPaymentsService.reconcileNativePayment).toHaveBeenCalledTimes(1);
    let ok = false;
    await act(async () => { finish({ paymentId: 'payment', invoiceId: 'invoice', config } as Awaited<ReturnType<typeof clientPaymentsService.initNativePayment>>); ok = await verifying; });
    expect(ok).toBe(true);
    unmount();
  });
  it('queues a check requested during initialization and does not authorize when it finds the target closed', async () => {
    const { result, unmount } = await ready();
    let finish!: (value: Awaited<ReturnType<typeof clientPaymentsService.initNativePayment>>) => void;
    jest.mocked(clientPaymentsService.initNativePayment).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    let verifying!: Promise<boolean>;
    await act(async () => { verifying = result.current.verifyPayable(); });
    // A foreground/poll check arrives while initialization is in flight; the target closes meanwhile.
    await act(async () => { await result.current.reconcile(); });
    jest.mocked(clientPaymentsService.reconcileNativePayment).mockResolvedValue({ paymentId: 'payment', invoiceId: 'invoice', status: 'PENDING', requiresReview: false, unavailableReason: 'BOOKING_EXPIRED' } as Awaited<ReturnType<typeof clientPaymentsService.reconcileNativePayment>>);
    let ok = true;
    await act(async () => { finish({ paymentId: 'payment', invoiceId: 'invoice', config } as Awaited<ReturnType<typeof clientPaymentsService.initNativePayment>>); ok = await verifying; });
    expect(ok).toBe(false);
    expect(result.current.phase).toBe('unavailable');
    expect(result.current.config).toBeNull();
    unmount();
  });
  it.each(['NATIVE_PAYMENT_IN_PROGRESS', 'HOSTED_PAYMENT_IN_PROGRESS'])('keeps %s in verification mode instead of offering Retry', async (code) => {
    const { result, unmount } = await ready();
    jest.mocked(clientPaymentsService.initNativePayment).mockRejectedValueOnce({ response: { data: { code, paymentId: 'payment', invoiceId: 'invoice' } } });
    jest.mocked(clientPaymentsService.reconcileNativePayment).mockClear();
    let ok = true;
    await act(async () => { ok = await result.current.verifyPayable(); });
    expect(ok).toBe(false);
    // verification continues (own check plus the one for the in-flight payment) and Retry stays hidden
    expect(jest.mocked(clientPaymentsService.reconcileNativePayment).mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(result.current.canRetryInit).toBe(false);
    expect(result.current.canResume).toBe(false);
    unmount();
  });
  it('skips the throttled re-initialization when the attempt was initialized moments ago', async () => {
    const { result, unmount } = await ready();
    jest.spyOn(Date, 'now').mockReturnValue(realNow + 1_000);
    jest.mocked(clientPaymentsService.initNativePayment).mockClear();
    let ok = false;
    await act(async () => { ok = await result.current.verifyPayable(); });
    expect(ok).toBe(true);
    expect(clientPaymentsService.initNativePayment).not.toHaveBeenCalled();
    unmount();
  });
  it('reports a throttled initialization (HTTP 429) as a temporary error without blocking later retries', async () => {
    const { result, unmount } = await ready();
    jest.mocked(clientPaymentsService.initNativePayment).mockRejectedValueOnce({ response: { status: 429, data: {} } });
    let ok = true;
    await act(async () => { ok = await result.current.verifyPayable(); });
    expect(ok).toBe(false);
    expect(result.current.phase).toBe('error');
    expect(result.current.error).toBe('nativePayment.tryAgainShortly');
    expect(result.current.canRetryInit).toBe(true);
    unmount();
  });
  it('fails closed on a configuration-changed conflict or a different payment identity', async () => {
    const { result, unmount } = await ready();
    jest.mocked(clientPaymentsService.initNativePayment).mockRejectedValueOnce({ response: { data: { code: 'PAYMENT_CONFIGURATION_CHANGED' } } });
    let ok = true;
    await act(async () => { ok = await result.current.verifyPayable(); });
    expect(ok).toBe(false);
    // The prepared configuration is revoked and the conflict is explicit, not silently back to ready.
    expect(result.current.phase).toBe('error');
    expect(result.current.error).toBe('nativePayment.conflict');
    expect(result.current.config).toBeNull();
    expect(result.current.canRetryInit).toBe(false);
    // A later reconcile that still allows creation must not re-offer the retry that hits the same conflict.
    await act(() => result.current.reconcile());
    expect(result.current.canRetryInit).toBe(false);
    expect(result.current.canResume).toBe(false);
    jest.mocked(clientPaymentsService.initNativePayment).mockResolvedValue({ paymentId: 'other-payment', invoiceId: 'invoice', config } as Awaited<ReturnType<typeof clientPaymentsService.initNativePayment>>);
    await act(async () => { ok = await result.current.verifyPayable(); });
    expect(ok).toBe(false);
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
