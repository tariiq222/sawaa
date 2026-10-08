jest.mock('react-native-moyasar-sdk/lib/module/specs/RTNSamsungPayNativeComponent.android', () => ({ SAMSUNG_PAY_BUTTON_COMPONENT_NAME: 'RTNSamsungPayButton' }));
jest.mock('react-native/Libraries/Settings/Settings', () => ({ __esModule: true, default: { get: (key: string) => key === 'AppleLanguages' ? ['en'] : 'en' } }));
jest.mock('react-native-webview', () => ({ WebView: 'WebView' }));
import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clientPaymentsService } from '@/services/client/payments';
import { clientBookingsService } from '@/services/client/bookings';
import { useInlineApplePay } from '../use-inline-apple-pay';
import type { PreparedApplePay } from '@/features/payments/DeferredApplePayButton';
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@/services/client/payments', () => ({ clientPaymentsService: { initNativePayment: jest.fn(), reconcileNativePayment: jest.fn() } }));
jest.mock('@/services/client/bookings', () => ({ clientBookingsService: { getById: jest.fn() } }));
jest.mock('@/services/client/packages', () => ({ clientPackagesService: {} }));
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }));
const config = { enabled: true, isLive: false, supportedNetworks: ['mada', 'visa', 'mastercard'], applePay: null,
  publishableKey: 'pk_test_fixture', givenId: 'a0000000-0000-4000-8000-000000000001', amount: 30000, currency: 'SAR', description: 'Invoice' };
const draft = { branchId: 'branch', employeeId: 'employee', serviceId: 'service', scheduledAt: '2026-10-10T10:00:00Z', durationOptionId: null, deliveryType: null };
const prepareBooking = jest.fn(async () => ({ bookingId: 'booking', invoiceId: 'invoice', draft }));
let client: QueryClient;
function wrapper({ children }: React.PropsWithChildren) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; }
beforeEach(async () => {
  jest.clearAllMocks(); await AsyncStorage.clear();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  jest.mocked(clientBookingsService.getById).mockResolvedValue({ id: 'booking', invoiceId: 'invoice', status: 'pending' } as Awaited<ReturnType<typeof clientBookingsService.getById>>);
  jest.mocked(clientPaymentsService.initNativePayment).mockResolvedValue({ paymentId: 'payment', invoiceId: 'invoice', config } as Awaited<ReturnType<typeof clientPaymentsService.initNativePayment>>);
  jest.mocked(clientPaymentsService.reconcileNativePayment).mockResolvedValue({ paymentId: 'payment', invoiceId: 'invoice', status: 'PENDING', requiresReview: false, canCreatePayment: true });
});
afterEach(() => client.clear());
function mount() { return renderHook(({ enabled, scope }: { enabled: boolean; scope: string }) => useInlineApplePay({ clientId: 'client', scope, enabled, prepareBooking }), { wrapper, initialProps: { enabled: true, scope: 'draft' } }); }
async function press(result: { current: ReturnType<typeof useInlineApplePay> }) {
  let promise!: Promise<PreparedApplePay | null>;
  await act(async () => { promise = result.current.prepare(); });
  let prepared!: PreparedApplePay | null;
  await act(async () => { prepared = await promise; });
  return prepared;
}
it('prepares Wallet from the same review screen without initializing before a tap', async () => {
  const { result } = mount();
  expect(clientPaymentsService.initNativePayment).not.toHaveBeenCalled();
  const prepared = await press(result);
  expect(prepared?.config).toEqual(config);
  expect(mockReplace).not.toHaveBeenCalled();
  expect(JSON.parse((await AsyncStorage.getItem('sawaa.native-payment:client:invoice'))!).paymentId).toBe('payment');
});
it('cancels then explicitly resumes the same invoice and reserved payment', async () => {
  const { result } = mount();
  const first = await press(result);
  act(() => first?.onCancel?.());
  const second = await press(result);
  expect(second?.config.givenId).toBe(config.givenId);
  expect(clientPaymentsService.initNativePayment).toHaveBeenCalledTimes(2);
  expect(clientPaymentsService.initNativePayment).toHaveBeenLastCalledWith('invoice', 'APPLE_PAY');
  expect(mockReplace).not.toHaveBeenCalled();
});
it('returns to ready after Wallet cancellation when the server confirms no provider payment', async () => {
  const { result } = mount();
  const prepared = await press(result);
  // Foreground reconciliation can complete before the sheet's cancellation callback.
  await act(async () => { await result.current.reconcile(); });
  act(() => prepared?.onCancel?.());
  expect(result.current.phase).toBe('ready');
  expect(result.current.locked).toBe(false);
  expect(clientPaymentsService.initNativePayment).toHaveBeenCalledTimes(1);
  expect(mockReplace).not.toHaveBeenCalled();
});
it('retries a declined payment with a fresh payment identity on the same booking and invoice', async () => {
  const { result } = mount();
  const first = await press(result);
  jest.mocked(clientPaymentsService.reconcileNativePayment).mockResolvedValue({ paymentId: 'payment', invoiceId: 'invoice', status: 'FAILED', requiresReview: false });
  await act(async () => { first?.onResult(); });
  await waitFor(() => expect(result.current.phase).toBe('failed'));
  expect(result.current.locked).toBe(false);
  const nextConfig = { ...config, givenId: 'a0000000-0000-4000-8000-000000000002' };
  jest.mocked(clientPaymentsService.initNativePayment).mockResolvedValue({ paymentId: 'payment-retry', invoiceId: 'invoice', config: nextConfig } as Awaited<ReturnType<typeof clientPaymentsService.initNativePayment>>);
  const second = await press(result);
  expect(second?.config.givenId).toBe('a0000000-0000-4000-8000-000000000002');
  expect(clientPaymentsService.initNativePayment).toHaveBeenLastCalledWith('invoice', 'APPLE_PAY');
  expect(JSON.parse((await AsyncStorage.getItem('sawaa.native-payment:client:invoice'))!)).toMatchObject({ bookingId: 'booking', invoiceId: 'invoice', paymentId: 'payment-retry' });
  expect(mockReplace).not.toHaveBeenCalled();
});
it('only navigates after backend payment and booking confirmation, retaining neutral processing', async () => {
  const { result } = mount();
  const prepared = await press(result);
  jest.mocked(clientPaymentsService.reconcileNativePayment).mockResolvedValueOnce({ paymentId: 'payment', invoiceId: 'invoice', status: 'PENDING', requiresReview: false, canCreatePayment: false });
  await act(async () => { prepared?.onResult(); });
  expect(result.current.phase).toBe('processing'); expect(result.current.locked).toBe(true);
  expect(mockReplace).not.toHaveBeenCalled();
  jest.mocked(clientPaymentsService.reconcileNativePayment).mockResolvedValueOnce({ paymentId: 'payment', invoiceId: 'invoice', status: 'COMPLETED', requiresReview: false });
  jest.mocked(clientBookingsService.getById).mockResolvedValue({ id: 'booking', invoiceId: 'invoice', status: 'confirmed' } as Awaited<ReturnType<typeof clientBookingsService.getById>>);
  await act(async () => { await result.current.reconcile(); });
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith({ pathname: '/(client)/booking/success', params: { bookingId: 'booking', invoiceId: 'invoice', paymentId: 'payment' } }));
});
it('does not reopen Wallet for a restored provider-created pending payment', async () => {
  await AsyncStorage.setItem('sawaa.native-payment:client:invoice', JSON.stringify({ clientId: 'client', invoiceId: 'invoice', bookingId: 'booking', paymentId: 'payment' }));
  jest.mocked(clientPaymentsService.reconcileNativePayment).mockResolvedValue({ paymentId: 'payment', invoiceId: 'invoice', status: 'PENDING', requiresReview: false, canCreatePayment: false });
  const { result } = mount();
  expect(await press(result)).toBeNull();
  expect(clientPaymentsService.initNativePayment).not.toHaveBeenCalled();
  expect(result.current.phase).toBe('pending');
  expect(result.current.locked).toBe(true);
});
it('admin disabling Apple Pay during preparation resolves without opening Wallet', async () => {
  let finish!: (value: Awaited<ReturnType<typeof clientPaymentsService.initNativePayment>>) => void;
  jest.mocked(clientPaymentsService.initNativePayment).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const { result, rerender } = mount(); let promise!: Promise<PreparedApplePay | null>;
  await act(async () => { promise = result.current.prepare(); });
  rerender({ enabled: false, scope: 'draft' });
  await act(async () => { finish({ paymentId: 'payment', invoiceId: 'invoice', config } as Awaited<ReturnType<typeof clientPaymentsService.initNativePayment>>); });
  expect(await promise).toBeNull(); expect(mockReplace).not.toHaveBeenCalled();
});

it('revokes the prepared Wallet and removes the inline observer when handing off to cards', async () => {
  const { result } = mount(); const prepared = await press(result);
  expect(prepared?.isCurrent()).toBe(true);
  act(() => result.current.handoff());
  expect(prepared?.isCurrent()).toBe(false);
  await act(async () => { prepared?.onResult(); });
  expect(result.current.phase).toBeNull(); expect(mockReplace).not.toHaveBeenCalled();
  expect(clientPaymentsService.reconcileNativePayment).not.toHaveBeenCalled();
});

it('clears revoked Wallet state when admin disables then re-enables online payment', async () => {
  const { result, rerender } = mount(); const prepared = await press(result);
  expect(result.current.locked).toBe(true);
  rerender({ enabled: false, scope: 'draft' });
  expect(prepared?.isCurrent()).toBe(false);
  act(() => prepared?.onCancel?.());
  rerender({ enabled: true, scope: 'draft' });
  expect(result.current.locked).toBe(false);
  expect(mockReplace).not.toHaveBeenCalled();
});

it('revokes the prepared Wallet when the server closes the payment target while Wallet is open', async () => {
  const { result } = mount(); const prepared = await press(result);
  expect(prepared?.isCurrent()).toBe(true);
  jest.mocked(clientPaymentsService.reconcileNativePayment).mockResolvedValueOnce({ paymentId: 'payment', invoiceId: 'invoice', status: 'PENDING', requiresReview: false, unavailableReason: 'BOOKING_EXPIRED' } as Awaited<ReturnType<typeof clientPaymentsService.reconcileNativePayment>>);
  await act(async () => { await result.current.reconcile(); });
  expect(result.current.phase).toBe('unavailable');
  expect(prepared?.isCurrent()).toBe(false);
});
