import type { ClientInvoice } from '@/services/client/payments';

export type ExistingBookingCheckoutPhase =
  | 'loading'
  | 'ready'
  | 'pending'
  | 'success'
  | 'deposit_confirmed'
  | 'failed'
  | 'cancelled'
  | 'expired'
  | 'missing_invoice'
  | 'invoice_mismatch'
  | 'error';

export interface ExistingBookingCheckoutInput {
  booking: { id: string; status: string; scheduledAt: string; invoiceId: string | null } | null;
  invoice: ClientInvoice | null;
  fetchError?: boolean;
  invoiceMismatch?: boolean;
}

const TERMINAL_BOOKING_STATUSES = new Set(['CANCELLED', 'CANCEL_REQUESTED']);

function normalized(value: string | null | undefined): string {
  return value?.trim().toUpperCase() ?? '';
}

function isPaidInvoice(invoice: ClientInvoice): boolean {
  return normalized(invoice.status) === 'PAID';
}

function isFailedInvoice(invoice: ClientInvoice): boolean {
  return ['CANCELLED', 'VOID', 'REFUNDED'].includes(normalized(invoice.status));
}

function isOperationallyConfirmedBooking(status: string): boolean {
  return ['CONFIRMED', 'COMPLETED', 'DEPOSIT_PAID'].includes(normalized(status));
}

function hasPaymentStatus(invoice: ClientInvoice, status: string): boolean {
  return (invoice.payments ?? []).some((payment) => normalized(payment.status) === status);
}

function hasPendingBankTransfer(invoice: ClientInvoice): boolean {
  return (invoice.payments ?? []).some((payment) => {
    const paymentStatus = normalized(payment.status);
    const method = normalized(payment.method).replace('-', '_');
    return paymentStatus === 'PENDING' && method === 'BANK_TRANSFER';
  });
}

/** Resolve payment and enrollment from authoritative server state. */
export function resolveExistingBookingCheckout(input: ExistingBookingCheckoutInput): ExistingBookingCheckoutPhase {
  if (input.fetchError) return 'error';
  if (!input.booking) return 'error';
  if (input.invoiceMismatch) return 'invoice_mismatch';

  const bookingStatus = normalized(input.booking.status);
  if (TERMINAL_BOOKING_STATUSES.has(bookingStatus)) return 'cancelled';
  if (bookingStatus === 'EXPIRED') return 'expired';

  if (input.booking.invoiceId && !input.invoice) return 'missing_invoice';
  if (!input.invoice) {
    return isOperationallyConfirmedBooking(input.booking.status) ? 'success' : 'missing_invoice';
  }

  // Appointment confirmation is independent of balance collection. Keep a
  // distinct phase so the screen retains the invoice and payment controls.
  if (bookingStatus === 'DEPOSIT_PAID' && !isPaidInvoice(input.invoice) && !isFailedInvoice(input.invoice)) {
    return 'deposit_confirmed';
  }

  const latestPayment = input.invoice.payments?.[0];
  const latestPaymentStatus = normalized(latestPayment?.status);
  if (hasPaymentStatus(input.invoice, 'PENDING_VERIFICATION') || hasPendingBankTransfer(input.invoice)) {
    return 'pending';
  }
  if (isPaidInvoice(input.invoice)) {
    return isOperationallyConfirmedBooking(input.booking.status) ? 'success' : 'pending';
  }
  if (isFailedInvoice(input.invoice)) return 'failed';
  if (normalized(input.invoice.status) === 'PARTIALLY_PAID') return 'pending';
  if (latestPaymentStatus === 'PENDING' || latestPaymentStatus === 'PENDING_VERIFICATION') return 'pending';
  // A completed payment row can be historical or partial. Only the
  // authoritative invoice PAID status above can settle a
  // program, and the booking must also be confirmed there.
  if (latestPaymentStatus === 'COMPLETED') return 'pending';
  if (latestPaymentStatus === 'FAILED' || latestPaymentStatus === 'CANCELLED') return 'failed';
  return 'ready';
}

export function canResumeHostedPayment(invoice: ClientInvoice | null): boolean {
  if (!invoice) return false;
  if (['PAID', 'DEPOSIT_PAID', 'CANCELLED', 'VOID', 'REFUNDED'].includes(normalized(invoice.status))) {
    return false;
  }
  if (hasPaymentStatus(invoice, 'PENDING_VERIFICATION') || hasPendingBankTransfer(invoice)) return false;
  const latestPaymentStatus = normalized(invoice.payments?.[0]?.status);
  return latestPaymentStatus === 'PENDING' || normalized(invoice.status) === 'PARTIALLY_PAID';
}

export function canStartHostedPayment(invoice: ClientInvoice | null): boolean {
  if (!invoice) return false;
  if (['PAID', 'DEPOSIT_PAID', 'CANCELLED', 'VOID', 'REFUNDED'].includes(normalized(invoice.status))) {
    return false;
  }
  return !hasPaymentStatus(invoice, 'PENDING_VERIFICATION') && !hasPendingBankTransfer(invoice);
}
