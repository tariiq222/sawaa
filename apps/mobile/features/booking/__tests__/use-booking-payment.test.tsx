import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import { Alert } from 'react-native';

let mockLocale: 'ar' | 'en' = 'en';
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => require('@/test-utils/translation').translatedTestMessage(key, mockLocale) }) }));

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockCreate = jest.fn();
const mockInit = jest.fn();
const mockBrowser = jest.fn();
const mockGetBooking = jest.fn();
let mockUserId: string | null = 'user-1';
let mockNativeError = false;
const mockNativeRefetch = jest.fn();
let mockNativeLoading = false;
let mockNativeEnabled = true;
let mockAppleAvailable = false;
jest.mock('@/features/payments/native-payment-capabilities', () => ({ useNativePaymentCapabilities: () => ({ enabled: mockNativeEnabled, applePayAvailable: mockAppleAvailable, isLoading: mockNativeLoading, isError: mockNativeError, refetch: mockNativeRefetch }) }), { virtual: true });
let mockBankEnabled = false;
const mockBankQuery = jest.fn((..._args: unknown[]) => ({ data: { enabled: mockBankEnabled, accounts: mockBankEnabled ? [{ id: 'bank-1' }] : [] }, isLoading: false, isError: false, refetch: jest.fn() }));
const mockStorage = new Map<string, string>();
jest.mock('expo-router', () => ({ useFocusEffect: () => {}, useRouter: () => ({ replace: mockReplace, push: mockPush }) }));
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ isRTL: false }) }));
jest.mock('@/hooks/use-redux', () => ({ useAppSelector: () => mockUserId }));
jest.mock('@/hooks/queries', () => ({
  useBankTransferSettings: (...args: unknown[]) => mockBankQuery(...args),
  usePublicPaymentMethods: () => ({ data: { moyasarEnabled: true, atClinicEnabled: true }, isLoading: false, isError: false, refetch: jest.fn() }),
}));
jest.mock('@/constants/config', () => ({ APP_SCHEME: 'sawa' }));
jest.mock('@/services/client/bookings', () => ({ clientBookingsService: {
  create: (...args: unknown[]) => mockCreate(...args), getById: (...args: unknown[]) => mockGetBooking(...args),
} }));
const mockGetInvoice = jest.fn();
jest.mock('@/services/client/payments', () => ({ clientPaymentsService: { initPayment: (...args: unknown[]) => mockInit(...args), getInvoice: (...args: unknown[]) => mockGetInvoice(...args) } }));
jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: (...args: unknown[]) => mockBrowser(...args) }));
jest.mock('expo-haptics', () => ({ notificationAsync: jest.fn(), NotificationFeedbackType: { Success: 'success' } }));
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: {
  getItem: async (key: string) => mockStorage.get(key) ?? null,
  setItem: async (key: string, value: string) => { mockStorage.set(key, value); },
  removeItem: async (key: string) => { mockStorage.delete(key); },
} }));

import { useBookingPayment } from '../use-booking-payment';
const mockQueryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
function wrapper({ children }: React.PropsWithChildren) { return <QueryClientProvider client={mockQueryClient}>{children}</QueryClientProvider>; }
beforeEach(() => mockQueryClient.clear());
afterEach(() => mockQueryClient.clear());

const input = { branchId: 'branch-1', employeeId: 'employee-1', serviceId: 'service-1', scheduledAt: '2026-10-01T10:00:00.000Z', amount: '45000', currency: 'SAR' };

describe('new booking payment retries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocale = 'en';
    mockStorage.clear();
    mockUserId = 'user-1';
    mockAppleAvailable = false;
    mockBankEnabled = false;
    mockNativeError = false;
    mockNativeLoading = false; mockNativeEnabled = true;
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockCreate.mockResolvedValue({ id: 'booking-1', invoiceId: 'invoice-1' });
    mockGetBooking.mockResolvedValue({ id: 'booking-1', invoiceId: 'invoice-1', status: 'pending', ...input });
    mockInit.mockResolvedValue({ paymentId: 'payment-1', redirectUrl: 'https://payment.example/session' });
    mockBrowser.mockResolvedValue({ type: 'success' });
  });

  it('makes portal and invoice resources stale after creating a booking', async () => {
    mockQueryClient.setQueryData(['portal', 'home'], { count: 0 });
    mockQueryClient.setQueryData(['client-payments', 'invoice', 'invoice-1'], { status: 'UNPAID' });
    const { result } = renderHook(() => useBookingPayment(input), { wrapper });
    await act(async () => { await result.current.pay(); });
    expect(mockQueryClient.getQueryState(['portal', 'home'])?.isInvalidated).toBe(true);
    expect(mockQueryClient.getQueryState(['client-payments', 'invoice', 'invoice-1'])?.isInvalidated).toBe(true);
  });

  it('preserves the portal cache when booking creation fails', async () => {
    mockCreate.mockRejectedValueOnce(new Error('slot unavailable'));
    mockQueryClient.setQueryData(['portal', 'home'], { count: 0 });
    const { result } = renderHook(() => useBookingPayment(input), { wrapper });
    await act(async () => { await result.current.pay(); });
    expect(mockQueryClient.getQueryState(['portal', 'home'])?.isInvalidated).toBe(false);
  });

  it('switches a bound checkout to cards without recreating it when its local record was lost', async () => {
    mockCreate.mockResolvedValue({ id: 'booking-1', invoiceId: 'invoice-1' });
    mockAppleAvailable = true;
    const first = renderHook(() => useBookingPayment(input), { wrapper });
    let identity: { bookingId: string; invoiceId: string | null } | null = null;
    await act(async () => { identity = await first.result.current.prepareApplePay(); });
    first.unmount();
    mockStorage.clear();
    const { result } = renderHook(() => useBookingPayment(input), { wrapper });
    await act(async () => { await result.current.pay('card', identity!); });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith(expect.objectContaining({ params: expect.objectContaining({ bookingId: 'booking-1', invoiceId: 'invoice-1', method: 'ONLINE_CARD' }) }));
  });

  it.each(['rejected method', 'failed read'])('retains a handed-off identity after %s and storage loss', async (failure) => {
    const { result } = renderHook(() => useBookingPayment(input), { wrapper });
    const identity = { bookingId: 'booking-1', invoiceId: 'invoice-1' };
    if (failure === 'failed read') mockGetBooking.mockRejectedValueOnce(new Error('offline'));
    await act(async () => { await result.current.pay('at_center', identity); });
    mockStorage.clear();
    await act(async () => { await result.current.pay('card'); });
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockGetBooking).toHaveBeenCalledTimes(2);
    expect(mockPush).toHaveBeenCalledWith(expect.objectContaining({ params: expect.objectContaining({ ...identity, method: 'ONLINE_CARD' }) }));
  });

  it.each(['ar', 'en'] as const)('explains an overlapping appointment in %s and opens the existing appointments', async (locale) => {
    mockLocale = locale;
    mockAppleAvailable = true;
    mockCreate.mockRejectedValueOnce({ response: { status: 409, data: { message: 'Client already has an overlapping appointment' } } });
    const { result } = renderHook(() => useBookingPayment(input), { wrapper });
    await act(async () => { await result.current.prepareApplePay(); });

    const [title, message, buttons] = jest.mocked(Alert.alert).mock.calls.at(-1)!;
    expect(title).toMatch(locale === 'ar' ? /موعد/ : /appointment/i);
    expect(message).toMatch(locale === 'ar' ? /مواعيدي/ : /My appointments/);
    expect(message).toMatch(locale === 'ar' ? /وقتًا آخر/ : /another time/);
    expect(message).not.toContain('Client already has');
    expect(mockPush).not.toHaveBeenCalled();
    expect(result.current.submitting).toBe(false);
    const appointmentsButton = buttons?.find((button) => (locale === 'ar' ? /^مواعيدي$/ : /appointments/i).test(button.text ?? ''));
    expect(appointmentsButton?.onPress).toEqual(expect.any(Function));
    appointmentsButton!.onPress!();
    expect(mockPush).toHaveBeenCalledWith('/(client)/(tabs)/appointments');
  });

  it('uses a localized fallback instead of exposing unknown server errors', async () => {
    mockLocale = 'ar';
    mockCreate.mockRejectedValueOnce({ response: { status: 500, data: { message: 'Internal server details' } } });
    const { result } = renderHook(() => useBookingPayment(input), { wrapper });
    await act(async () => { await result.current.pay(); });
    expect(Alert.alert).toHaveBeenCalledWith(expect.stringMatching(/خطأ/), expect.stringMatching(/تعذّر/));
    expect(jest.mocked(Alert.alert).mock.calls.at(-1)?.[1]).not.toContain('Internal server details');
  });

  it('keeps confirmation in the back stack when opening the selected card form', async () => {
    const { result } = renderHook(() => useBookingPayment(input), { wrapper });
    await act(async () => { await result.current.pay(); });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockInit).not.toHaveBeenCalled();
    expect(mockBrowser).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/(client)/payments/native-checkout', params: {
      invoiceId: 'invoice-1', bookingId: 'booking-1', method: 'ONLINE_CARD', fromBookingConfirm: 'true',
    } });
  });

  it('offers Apple Pay only while the wallet is available and resets removed selection', () => {
    const { result, rerender } = renderHook(() => useBookingPayment(input), { wrapper });
    expect(result.current.availableMethods).not.toContain('apple_pay');
    mockAppleAvailable = true;
    rerender({});
    act(() => result.current.setMethod('apple_pay'));
    expect(result.current.method).toBe('apple_pay');
    mockAppleAvailable = false;
    rerender({});
    expect(result.current.method).toBe('card');
  });

  it('preserves the selected Apple method in native route params', async () => {
    mockAppleAvailable = true;
    const { result } = renderHook(() => useBookingPayment(input), { wrapper });
    act(() => result.current.setMethod('apple_pay'));
    await act(async () => { await result.current.pay(); });
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/(client)/payments/native-checkout', params: {
      invoiceId: 'invoice-1', bookingId: 'booking-1', method: 'APPLE_PAY', fromBookingConfirm: 'true',
    } });
  });

  it('prepares Apple Pay on the review screen without opening another route and reuses the booking', async () => {
    mockAppleAvailable = true;
    const { result } = renderHook(() => useBookingPayment(input), { wrapper });
    let prepared: unknown;
    await act(async () => { prepared = await result.current.prepareApplePay(); });
    expect(prepared).toEqual(expect.objectContaining({ bookingId: 'booking-1', invoiceId: 'invoice-1' }));
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    await act(async () => { await result.current.prepareApplePay(); });
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('rejects a direct Apple action once admin capability is removed, while center stays usable', async () => {
    mockAppleAvailable = true;
    const { result, rerender } = renderHook(() => useBookingPayment(input), { wrapper });
    mockAppleAvailable = false; mockNativeEnabled = false;
    rerender({});
    await act(async () => { await result.current.prepareApplePay(); });
    expect(mockCreate).not.toHaveBeenCalled();
    await act(async () => { await result.current.pay('at_center'); });
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ payAtClinic: true }));
  });

  it('resumes the saved invoice after remounting instead of creating again', async () => {
    const first = renderHook(() => useBookingPayment(input), { wrapper });
    await act(async () => { await first.result.current.pay(); });
    first.unmount();
    const second = renderHook(() => useBookingPayment(input), { wrapper });
    await act(async () => { await second.result.current.pay(); });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockGetBooking).toHaveBeenCalledWith('booking-1');
  });

  it.each(['cancelled', 'expired'] as const)('opens a fresh invoice card route for the exact same slot after a verified %s checkout on re-entry', async (status) => {
    const first = renderHook(() => useBookingPayment(input), { wrapper });
    await act(async () => { await first.result.current.pay(); });
    first.unmount();
    mockGetBooking.mockResolvedValue({ id: 'booking-1', invoiceId: 'invoice-1', status, ...input });
    mockCreate.mockResolvedValueOnce({ id: 'booking-2', invoiceId: 'invoice-2' });
    const second = renderHook(() => useBookingPayment(input), { wrapper });
    await act(async () => { await second.result.current.pay(); });
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockCreate).toHaveBeenLastCalledWith({ branchId: 'branch-1', employeeId: 'employee-1', serviceId: 'service-1', scheduledAt: '2026-10-01T10:00:00.000Z', deliveryType: undefined });
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/(client)/payments/native-checkout', params: { bookingId: 'booking-2', invoiceId: 'invoice-2', method: 'ONLINE_CARD', fromBookingConfirm: 'true' } });
  });

  it('keeps an explicitly bound cancelled checkout closed instead of creating another reservation', async () => {
    mockGetBooking.mockResolvedValue({ id: 'booking-1', invoiceId: 'invoice-1', status: 'cancelled', ...input });
    const { result } = renderHook(() => useBookingPayment(input), { wrapper });
    await act(async () => { await result.current.pay('card', { bookingId: 'booking-1', invoiceId: 'invoice-1' }); });
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    expect(result.current.unavailableReason).toBe('BOOKING_CLOSED');
  });

  it('ignores duplicate presses in the same frame', async () => {
    const { result } = renderHook(() => useBookingPayment(input), { wrapper });
    await act(async () => { await Promise.all([result.current.pay(), result.current.pay()]); });
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('omits blank duration options from booking creation', async () => {
    const { result } = renderHook(() => useBookingPayment({ ...input, durationOptionId: '  ' }), { wrapper });
    await act(async () => { await result.current.pay(); });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate.mock.calls[0][0]).not.toHaveProperty('durationOptionId');
  });
  it('refuses an expired saved booking without creating a replacement', async () => {
    const { result } = renderHook(() => useBookingPayment(input), { wrapper });
    await act(async () => { await result.current.pay(); });
    mockGetBooking.mockResolvedValue({ id: 'booking-1', invoiceId: 'invoice-1', status: 'expired', ...input });
    await act(async () => { await result.current.pay(); });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockInit).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
    expect(result.current.unavailableReason).toBe('BOOKING_EXPIRED');
    act(() => result.current.reviewAvailability());
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/(client)/booking/[serviceId]', params: { serviceId: 'service-1', employeeId: 'employee-1', branchId: 'branch-1' } });
  });

  it('routes a completed saved booking to its result without charging again', async () => {
    const { result } = renderHook(() => useBookingPayment(input), { wrapper });
    await act(async () => { await result.current.pay(); });
    mockGetBooking.mockResolvedValue({ id: 'booking-1', invoiceId: 'invoice-1', status: 'confirmed', ...input });
    await act(async () => { await result.current.pay(); });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockInit).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/(client)/booking/success', params: { bookingId: 'booking-1', invoiceId: 'invoice-1' } });
  });

  it('keeps the existing payment choice visible and explains an online invoice when pay-at-center is selected on retry', async () => {
    const { result } = renderHook(() => useBookingPayment(input), { wrapper });
    await act(async () => { await result.current.pay(); });
    act(() => { result.current.setMethod('at_center'); });
    await act(async () => { await result.current.pay(); });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
    expect(result.current.method).toBe('at_center');
    expect(Alert.alert).toHaveBeenCalledWith(expect.any(String), expect.stringMatching(/invoice|فاتورة/));
    act(() => { result.current.setMethod('card'); });
    await act(async () => { await result.current.pay(); });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/(client)/payments/native-checkout', params: { bookingId: 'booking-1', invoiceId: 'invoice-1', method: 'ONLINE_CARD', fromBookingConfirm: 'true' } });
  });

  it('keeps the authenticated bank-settings query disabled for a guest', () => {
    mockUserId = null;
    renderHook(() => useBookingPayment(input, false), { wrapper });
    expect(mockBankQuery).toHaveBeenCalledWith(false);
  });

});

it('keeps pay-at-center creation and result navigation intact', async () => {
  mockUserId = 'user-1'; mockStorage.clear(); jest.clearAllMocks();
  mockCreate.mockResolvedValue({ id: 'at-center', invoiceId: null });
  const { result } = renderHook(() => useBookingPayment(input), { wrapper });
  act(() => result.current.setMethod('at_center'));
  await act(async () => { await result.current.pay(); });
  expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ payAtClinic: true }));
  expect(mockReplace).toHaveBeenCalledWith({ pathname: '/(client)/booking/success', params: { bookingId: 'at-center' } });
  expect(mockBrowser).not.toHaveBeenCalled();
});

it('preserves bank transfer routing and guest draft without creating a booking', async () => {
  mockUserId = null; mockStorage.clear(); jest.clearAllMocks(); mockBankEnabled = true;
  const { result, rerender } = renderHook(() => useBookingPayment(input), { wrapper });
  await act(async () => { await result.current.pay(); });
  expect(mockCreate).not.toHaveBeenCalled();
  mockUserId = 'user-1'; rerender({});
  mockCreate.mockResolvedValue({ id: 'bank-booking', invoiceId: 'bank-invoice' });
  act(() => result.current.setMethod('bank_transfer'));
  await act(async () => { await result.current.pay(); });
  expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ serviceId: input.serviceId, scheduledAt: input.scheduledAt }));
  expect(mockReplace).toHaveBeenCalledWith({ pathname: '/(client)/booking/bank-transfer', params: { bookingId: 'bank-booking', invoiceId: 'bank-invoice', amount: '45000' } });
});

it('does not silently select pay-at-center while native capability is loading', () => {
  mockNativeLoading = true; mockNativeEnabled = false; mockUserId = 'user-1'; mockBankEnabled = false;
  const { result, rerender } = renderHook(() => useBookingPayment(input), { wrapper });
  expect(result.current.method).toBe('card');
  expect(result.current.canPay).toBe(false);
  mockNativeLoading = false; mockNativeEnabled = true;
  rerender({});
  expect(result.current.method).toBe('card');
});

it('shows capability fetch failure, keeps Apple selected and retries in place despite offline alternatives', () => {
  mockNativeLoading = false; mockNativeEnabled = true; mockNativeError = false; mockAppleAvailable = true; mockBankEnabled = true;
  const { result, rerender } = renderHook(() => useBookingPayment(input), { wrapper });
  act(() => result.current.setMethod('apple_pay'));
  mockNativeError = true; mockNativeEnabled = false; mockAppleAvailable = false;
  rerender({});
  expect(result.current.methodsError).toBe(true);
  expect(result.current.method).toBe('apple_pay');
  act(() => result.current.retryMethods());
  expect(mockNativeRefetch).toHaveBeenCalled();
  mockNativeError = false; mockNativeEnabled = true; mockAppleAvailable = true;
  rerender({});
  expect(result.current.method).toBe('apple_pay');
  expect(result.current.canPay).toBe(true);
});

describe('bank transfer on a resumed booking checks the invoice reservations on the server', () => {
  async function resume(invoice: () => Promise<unknown>) {
    mockUserId = 'user-1'; mockStorage.clear(); jest.clearAllMocks(); mockBankEnabled = true; mockNativeEnabled = true; mockNativeLoading = false; mockNativeError = false;
    mockCreate.mockResolvedValue({ id: 'resumed-booking', invoiceId: 'resumed-invoice' });
    mockGetBooking.mockResolvedValue({ id: 'resumed-booking', invoiceId: 'resumed-invoice', status: 'pending' });
    mockGetInvoice.mockImplementation(invoice);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { result } = renderHook(() => useBookingPayment(input), { wrapper });
    await act(async () => { await result.current.pay('card'); });
    await act(async () => { await result.current.pay('bank_transfer'); });
    return alert;
  }
  const bankRoute = { pathname: '/(client)/booking/bank-transfer', params: { invoiceId: 'resumed-invoice', amount: '45000', bookingId: 'resumed-booking' } };
  it('blocks when committed payments cover the invoice, even with no local attempt (another device)', async () => {
    const alert = await resume(async () => ({ id: 'resumed-invoice', total: 45000, payments: [{ status: 'PENDING', amount: 45000 }] }));
    expect(mockGetInvoice).toHaveBeenCalledWith('resumed-invoice');
    expect(alert).toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalledWith(bankRoute);
    alert.mockRestore();
  });
  it('allows bank transfer when a failed attempt no longer commits any amount', async () => {
    const alert = await resume(async () => ({ id: 'resumed-invoice', total: 45000, payments: [{ status: 'FAILED', amount: 45000 }] }));
    expect(alert).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith(bankRoute);
    alert.mockRestore();
  });
  it('blocks when the invoice cannot be read or has no usable total', async () => {
    const offline = await resume(async () => { throw new Error('network down'); });
    expect(offline).toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalledWith(bankRoute);
    offline.mockRestore();
    const unknown = await resume(async () => ({ id: 'resumed-invoice', payments: [] }));
    expect(unknown).toHaveBeenCalled();
    unknown.mockRestore();
  });
});
