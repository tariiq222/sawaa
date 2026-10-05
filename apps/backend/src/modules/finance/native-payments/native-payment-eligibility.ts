import { BookingStatus, InvoiceStatus } from '@prisma/client';
import type { NativePaymentReconcileResponse } from '@sawaa/shared/types';
import { isElapsedUnconfirmedBookingHold } from '../booking-payment-hold.helper';
import { isNonPayableInvoiceStatus } from '../invoice-payment-state.helper';

/** The same target gate is used for reservation and provider404 resumption. */
export function nativePaymentUnavailableReason(
  invoice: { status: InvoiceStatus; bookingId: string | null },
  booking: {
    status: BookingStatus;
    expiresAt?: Date | null;
    isHistoricalImport?: boolean;
  } | null,
): NativePaymentReconcileResponse['unavailableReason'] {
  if (isNonPayableInvoiceStatus(invoice.status)) return 'INVOICE_CLOSED';
  if (!invoice.bookingId) return undefined;
  if (
    booking?.status === BookingStatus.EXPIRED ||
    (booking && isElapsedUnconfirmedBookingHold(booking))
  ) return 'BOOKING_EXPIRED';
  if (!booking || !([
    BookingStatus.PENDING,
    BookingStatus.AWAITING_PAYMENT,
    BookingStatus.DEPOSIT_PAID,
    BookingStatus.CONFIRMED,
    BookingStatus.COMPLETED,
  ] as readonly BookingStatus[]).includes(booking.status)) return 'BOOKING_CLOSED';
  return undefined;
}
