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
