import { AppState, type AppStateStatus } from 'react-native';
import { act, renderHook, waitFor } from '@testing-library/react-native';

jest.mock('@/services/client/bookings', () => ({
  clientBookingsService: { getById: jest.fn() },
}));
jest.mock('@/services/client/payments', () => ({
  clientPaymentsService: { getInvoice: jest.fn() },
}));
jest.mock('@/hooks/queries/useClientBookings', () => ({
  clientBookingsKeys: {
    all: ['bookings'],
    detail: (id: string) => ['bookings', 'detail', id],
  },
}));

import { clientBookingsService } from '@/services/client/bookings';
import { clientPaymentsService } from '@/services/client/payments';
import { queryClient } from '@/services/query-client';
import { useExistingBookingCheckout } from '@/features/booking/use-existing-booking-checkout';

const mockedBookings = clientBookingsService as unknown as { getById: jest.Mock };
const mockedPayments = clientPaymentsService as unknown as { getInvoice: jest.Mock };

const booking = {
  id: 'booking-1',
  invoiceId: 'invoice-1',
  scheduledAt: '',
  status: 'pending',
} as const;

const invoice = {
  id: 'invoice-1',
  status: 'PAID',
  total: 10000,
  currency: 'SAR',
  payments: [{ id: 'payment-1', status: 'COMPLETED' }],
};

beforeEach(() => {
  jest.clearAllMocks();
  queryClient.clear();
});

describe('useExistingBookingCheckout', () => {
  it('keeps a paid enrollment pending until the server confirms the booking', async () => {
    mockedBookings.getById.mockResolvedValue(booking);
    mockedPayments.getInvoice.mockResolvedValue(invoice);

    const { result } = renderHook(() => useExistingBookingCheckout({
      bookingId: 'booking-1',
      invoiceId: 'invoice-1',
    }));

    await waitFor(() => expect(result.current.phase).toBe('pending'));
    expect(mockedBookings.getById).toHaveBeenCalledWith('booking-1');
    expect(mockedPayments.getInvoice).toHaveBeenCalledWith('invoice-1');
  });

  it('refetches both authoritative records when the app returns to the foreground', async () => {
    let bookingReads = 0;
    mockedBookings.getById.mockImplementation(async () => {
      bookingReads += 1;
      return bookingReads === 1 ? booking : { ...booking, status: 'confirmed' };
    });
    mockedPayments.getInvoice.mockResolvedValue(invoice);
    const listeners: Array<(state: AppStateStatus) => void> = [];
    const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, handler) => {
      listeners.push(handler);
      return { remove: jest.fn() };
    });

    const { result } = renderHook(() => useExistingBookingCheckout({ bookingId: 'booking-1' }));
    await waitFor(() => expect(result.current.phase).toBe('pending'));

    await act(async () => {
      listeners[0]?.('active');
    });
    await waitFor(() => expect(result.current.phase).toBe('success'));
    expect(mockedBookings.getById).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });

  it('rejects a callback invoice that does not match the booking invoice', async () => {
    mockedBookings.getById.mockResolvedValue(booking);
    mockedPayments.getInvoice.mockResolvedValue(invoice);

    const { result } = renderHook(() => useExistingBookingCheckout({
      bookingId: 'booking-1',
      invoiceId: 'other-invoice',
    }));

    await waitFor(() => expect(result.current.phase).toBe('invoice_mismatch'));
    expect(mockedPayments.getInvoice).not.toHaveBeenCalled();
  });
});

describe('deposit balance refresh', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('refreshes an unresolved balance payment through settlement and then stops', async () => {
    mockedBookings.getById.mockResolvedValue({ ...booking, status: 'deposit_paid' });
    mockedPayments.getInvoice.mockResolvedValue({ ...invoice, status: 'PARTIALLY_PAID', payments: [{ id: 'balance', status: 'PENDING' }] });
    const { result, unmount } = renderHook(() => useExistingBookingCheckout({ bookingId: 'booking-1' }));
    await act(async () => {});
    expect(result.current.phase).toBe('deposit_confirmed');
    mockedPayments.getInvoice.mockResolvedValue(invoice);
    await act(async () => { jest.advanceTimersByTime(3000); });
    expect(result.current.phase).toBe('success');
    expect(mockedBookings.getById).toHaveBeenCalledTimes(2);
    await act(async () => { jest.advanceTimersByTime(30000); });
    expect(mockedBookings.getById).toHaveBeenCalledTimes(2);
    unmount();
  });

  it('does not poll an idle unpaid balance with only a settled deposit', async () => {
    mockedBookings.getById.mockResolvedValue({ ...booking, status: 'deposit_paid' });
    mockedPayments.getInvoice.mockResolvedValue({ ...invoice, status: 'PARTIALLY_PAID' });
    const { result, unmount } = renderHook(() => useExistingBookingCheckout({ bookingId: 'booking-1' }));
    await act(async () => {});
    expect(result.current.phase).toBe('deposit_confirmed');
    await act(async () => { jest.advanceTimersByTime(30000); });
    expect(mockedBookings.getById).toHaveBeenCalledTimes(1);
    unmount();
  });
});

afterEach(() => queryClient.clear());
it('refreshes portal, invoice and package caches after server confirmation', async () => {
  const keys = [['portal', 'home'], ['portal', 'summary'], ['client-payments', 'invoice', 'invoice-1'], ['packages', 'purchases']];
  keys.forEach((key) => queryClient.setQueryData(key, { cached: true }));
  mockedBookings.getById.mockResolvedValue({ ...booking, status: 'confirmed' });
  mockedPayments.getInvoice.mockResolvedValue(invoice);
  const { result } = renderHook(() => useExistingBookingCheckout({ bookingId: 'booking-1', invoiceId: 'invoice-1' }));
  await waitFor(() => expect(result.current.phase).toBe('success'));
  keys.forEach((key) => expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true));
});
it('preserves portal and invoice caches when the authoritative read fails', async () => {
  queryClient.setQueryData(['portal', 'home'], { cached: true });
  queryClient.setQueryData(['client-payments', 'invoice', 'invoice-1'], { cached: true });
  mockedBookings.getById.mockRejectedValue(new Error('offline'));
  const { result } = renderHook(() => useExistingBookingCheckout({ bookingId: 'booking-1' }));
  await waitFor(() => expect(result.current.phase).toBe('error'));
  expect(queryClient.getQueryState(['portal', 'home'])?.isInvalidated).toBe(false);
  expect(queryClient.getQueryState(['client-payments', 'invoice', 'invoice-1'])?.isInvalidated).toBe(false);
});
