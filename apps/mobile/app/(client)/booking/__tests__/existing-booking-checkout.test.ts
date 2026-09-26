import {
  canResumeHostedPayment,
  canStartHostedPayment,
  resolveExistingBookingCheckout,
  type ExistingBookingCheckoutInput,
} from '@/features/booking/existing-booking-checkout-state';

const baseBooking = {
  id: 'booking-1',
  status: 'awaiting_payment',
  scheduledAt: '2999-01-01T00:00:00.000Z',
  invoiceId: 'invoice-1',
};

const baseInvoice = {
  id: 'invoice-1',
  status: 'DRAFT',
  total: 10000,
  currency: 'SAR',
  payments: [],
};

function input(overrides: Partial<ExistingBookingCheckoutInput> = {}): ExistingBookingCheckoutInput {
  return {
    booking: baseBooking,
    invoice: baseInvoice,
    ...overrides,
  };
}

describe('resolveExistingBookingCheckout', () => {
  it('keeps an unpaid enrollment in checkout', () => {
    expect(resolveExistingBookingCheckout(input())).toBe('ready');
  });

  it('does not treat an invoice as complete while its booking still awaits payment', () => {
    expect(resolveExistingBookingCheckout(input({
      invoice: { ...baseInvoice, status: 'PAID', payments: [{ id: 'payment-1', status: 'COMPLETED' }] },
    }))).toBe('pending');
  });

  it('requires confirmed booking state after a completed payment', () => {
    expect(resolveExistingBookingCheckout(input({
      booking: { ...baseBooking, status: 'confirmed' },
      invoice: { ...baseInvoice, status: 'PAID', payments: [{ id: 'payment-1', status: 'COMPLETED' }] },
    }))).toBe('success');
  });

  it('does not settle a partially paid invoice from one completed payment row', () => {
    expect(resolveExistingBookingCheckout(input({
      booking: { ...baseBooking, status: 'confirmed' },
      invoice: { ...baseInvoice, status: 'PARTIALLY_PAID', payments: [{ id: 'payment-1', status: 'COMPLETED' }] },
    }))).toBe('pending');
  });

  it('lets the latest live attempt override an older failed payment', () => {
    expect(resolveExistingBookingCheckout(input({
      invoice: {
        ...baseInvoice,
        payments: [
          { id: 'payment-live', status: 'PENDING' },
          { id: 'payment-old', status: 'FAILED' },
        ],
      },
    }))).toBe('pending');
  });

  it('keeps an older pending bank transfer authoritative over a newer failure', () => {
    expect(resolveExistingBookingCheckout(input({
      invoice: {
        ...baseInvoice,
        payments: [
          { id: 'payment-new', status: 'FAILED' },
          { id: 'payment-bank', status: 'PENDING', method: 'BANK_TRANSFER' },
        ],
      },
    }))).toBe('pending');
  });

  it('treats cancelled and expired bookings as terminal', () => {
    expect(resolveExistingBookingCheckout(input({ booking: { ...baseBooking, status: 'cancelled' } }))).toBe('cancelled');
    expect(resolveExistingBookingCheckout(input({ booking: { ...baseBooking, status: 'expired' } }))).toBe('expired');
  });

  it('does not claim success when the paid enrollment has no invoice', () => {
    expect(resolveExistingBookingCheckout(input({ invoice: null }))).toBe('missing_invoice');
    expect(resolveExistingBookingCheckout({
      booking: { ...baseBooking, invoiceId: null },
      invoice: null,
    })).toBe('missing_invoice');
  });

  it('rejects a callback invoice that differs from the booking invoice', () => {
    expect(resolveExistingBookingCheckout(input({ invoiceMismatch: true }))).toBe('invoice_mismatch');
  });

  it('allows retrying a pending hosted payment but never bank-transfer verification', () => {
    expect(canResumeHostedPayment({ ...baseInvoice, payments: [{ id: 'payment-1', status: 'PENDING' }] })).toBe(true);
    expect(canResumeHostedPayment({ ...baseInvoice, payments: [{ id: 'payment-1', status: 'PENDING_VERIFICATION' }] })).toBe(false);
    expect(canResumeHostedPayment({
      ...baseInvoice,
      status: 'PARTIALLY_PAID',
      payments: [{ id: 'payment-1', status: 'PENDING_VERIFICATION' }],
    })).toBe(false);
    expect(canResumeHostedPayment({
      ...baseInvoice,
      payments: [
        { id: 'payment-new', status: 'FAILED' },
        { id: 'payment-bank', status: 'PENDING', method: 'BANK_TRANSFER' },
      ],
    })).toBe(false);
  });

  it('never offers hosted retry for a terminal invoice', () => {
    expect(canStartHostedPayment({ ...baseInvoice, status: 'VOID' })).toBe(false);
    expect(canStartHostedPayment({ ...baseInvoice, status: 'CANCELLED' })).toBe(false);
    expect(canStartHostedPayment({ ...baseInvoice, status: 'REFUNDED' })).toBe(false);
  });

  it('allows free confirmed enrollment without inventing a scheduled date', () => {
    expect(resolveExistingBookingCheckout({
      booking: { ...baseBooking, status: 'confirmed', invoiceId: null },
      invoice: null,
    })).toBe('success');
  });

  it('returns an error state when the authoritative fetch failed', () => {
    expect(resolveExistingBookingCheckout(input({ fetchError: true }))).toBe('error');
  });
});
