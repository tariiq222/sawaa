import { act, renderHook } from '@testing-library/react-native';
import { Alert } from 'react-native';

const mockReplace = jest.fn();
const mockCreate = jest.fn();
const mockInit = jest.fn();
const mockBrowser = jest.fn();
const mockGetBooking = jest.fn();
let mockUserId: string | null = 'user-1';
const mockBankQuery = jest.fn((..._args: unknown[]) => ({ data: { enabled: false, accounts: [] }, isLoading: false, isError: false }));
const mockStorage = new Map<string, string>();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }));
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ isRTL: false }) }));
jest.mock('@/hooks/use-redux', () => ({ useAppSelector: () => mockUserId }));
jest.mock('@/hooks/queries', () => ({
  useBankTransferSettings: (...args: unknown[]) => mockBankQuery(...args),
  usePublicPaymentMethods: () => ({ data: { moyasarEnabled: true, atClinicEnabled: true }, isLoading: false, isError: false }),
}));
jest.mock('@/constants/config', () => ({ APP_SCHEME: 'sawa' }));
jest.mock('@/services/client/bookings', () => ({ clientBookingsService: {
  create: (...args: unknown[]) => mockCreate(...args), getById: (...args: unknown[]) => mockGetBooking(...args),
} }));
jest.mock('@/services/client/payments', () => ({ clientPaymentsService: { initPayment: (...args: unknown[]) => mockInit(...args) } }));
jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: (...args: unknown[]) => mockBrowser(...args) }));
jest.mock('expo-haptics', () => ({ notificationAsync: jest.fn(), NotificationFeedbackType: { Success: 'success' } }));
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: {
  getItem: async (key: string) => mockStorage.get(key) ?? null,
  setItem: async (key: string, value: string) => { mockStorage.set(key, value); },
  removeItem: async (key: string) => { mockStorage.delete(key); },
} }));

import { useBookingPayment } from '../use-booking-payment';
const input = { branchId: 'branch-1', employeeId: 'employee-1', serviceId: 'service-1', scheduledAt: '2026-10-01T10:00:00.000Z', amount: '45000', currency: 'SAR' };

describe('new booking payment retries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage.clear();
    mockUserId = 'user-1';
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockCreate.mockResolvedValue({ id: 'booking-1', invoiceId: 'invoice-1' });
    mockGetBooking.mockResolvedValue({ id: 'booking-1', invoiceId: 'invoice-1', status: 'pending', ...input });
    mockInit.mockResolvedValue({ paymentId: 'payment-1', redirectUrl: 'https://payment.example/session' });
    mockBrowser.mockResolvedValue({ type: 'success' });
  });

  it.each(['initialization', 'browser'])('reuses the created booking after %s fails', async (failure) => {
    if (failure === 'initialization') mockInit.mockRejectedValueOnce(new Error('init failed'));
    else mockBrowser.mockRejectedValueOnce(new Error('browser failed'));
    const { result } = renderHook(() => useBookingPayment(input));
    await act(async () => { await result.current.pay(); });
    expect(Alert.alert).toHaveBeenCalled();
    await act(async () => { await result.current.pay(); });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockInit).toHaveBeenLastCalledWith('invoice-1', 'ONLINE_CARD');
    expect(mockReplace).toHaveBeenCalledWith(expect.objectContaining({ params: expect.objectContaining({ bookingId: 'booking-1', invoiceId: 'invoice-1' }) }));
  });

  it('resumes the saved invoice after remounting instead of creating again', async () => {
    mockInit.mockRejectedValueOnce(new Error('init failed'));
    const first = renderHook(() => useBookingPayment(input));
    await act(async () => { await first.result.current.pay(); });
    first.unmount();
    const second = renderHook(() => useBookingPayment(input));
    await act(async () => { await second.result.current.pay(); });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockGetBooking).toHaveBeenCalledWith('booking-1');
  });

  it('ignores duplicate presses in the same frame', async () => {
    const { result } = renderHook(() => useBookingPayment(input));
    await act(async () => { await Promise.all([result.current.pay(), result.current.pay()]); });
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('omits blank duration options from booking creation', async () => {
    const { result } = renderHook(() => useBookingPayment({ ...input, durationOptionId: '  ' }));
    await act(async () => { await result.current.pay(); });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate.mock.calls[0][0]).not.toHaveProperty('durationOptionId');
  });
  it('refuses an expired saved booking without creating a replacement', async () => {
    mockInit.mockRejectedValueOnce(new Error('init failed'));
    const { result } = renderHook(() => useBookingPayment(input));
    await act(async () => { await result.current.pay(); });
    mockGetBooking.mockResolvedValue({ id: 'booking-1', invoiceId: 'invoice-1', status: 'expired', ...input });
    await act(async () => { await result.current.pay(); });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockInit).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('routes a completed saved booking to its result without charging again', async () => {
    mockInit.mockRejectedValueOnce(new Error('init failed'));
    const { result } = renderHook(() => useBookingPayment(input));
    await act(async () => { await result.current.pay(); });
    mockGetBooking.mockResolvedValue({ id: 'booking-1', invoiceId: 'invoice-1', status: 'confirmed', ...input });
    await act(async () => { await result.current.pay(); });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockInit).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/(client)/booking/success', params: { bookingId: 'booking-1', invoiceId: 'invoice-1' } });
  });

  it('keeps an existing invoice in the resume flow when pay-at-center is selected on retry', async () => {
    mockInit.mockRejectedValueOnce(new Error('init failed'));
    const { result } = renderHook(() => useBookingPayment(input));
    await act(async () => { await result.current.pay(); });
    act(() => { result.current.setMethod('at_center'); });
    await act(async () => { await result.current.pay(); });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/(client)/booking/payment', params: { bookingId: 'booking-1', invoiceId: 'invoice-1', amount: '45000', currency: 'SAR' } });
  });

  it('keeps the authenticated bank-settings query disabled for a guest', () => {
    mockUserId = null;
    renderHook(() => useBookingPayment(input, false));
    expect(mockBankQuery).toHaveBeenCalledWith(false);
  });

});
