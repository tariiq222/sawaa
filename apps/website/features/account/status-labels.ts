/**
 * Localized status labels for the client account area.
 *
 * Maps backend payment statuses, invoice statuses, and booking delivery types
 * to dictionary keys so components never render raw English enum values.
 */

import type { MessageKey } from '@/features/locale/dictionary';

export const PAYMENT_STATUS_KEY: Record<string, MessageKey> = {
  COMPLETED: 'account.payment.completed',
  PENDING: 'account.payment.pending',
  PENDING_VERIFICATION: 'account.payment.pending_verification',
  FAILED: 'account.payment.failed',
  REFUNDED: 'account.payment.refunded',
  PARTIALLY_REFUNDED: 'account.payment.partially_refunded',
  UNKNOWN: 'account.payment.unknown',
};

export const INVOICE_STATUS_KEY: Record<string, MessageKey> = {
  DRAFT: 'account.invoice.draft',
  ISSUED: 'account.invoice.issued',
  PAID: 'account.invoice.paid',
  PARTIALLY_PAID: 'account.invoice.partially_paid',
  PARTIALLY_REFUNDED: 'account.invoice.partially_refunded',
  REFUNDED: 'account.invoice.refunded',
  VOID: 'account.invoice.void',
};

export const DELIVERY_TYPE_KEY: Record<string, MessageKey> = {
  IN_PERSON: 'account.delivery.in_person',
  ONLINE: 'account.delivery.online',
};

export function paymentStatusKey(status: string | null | undefined): MessageKey {
  return PAYMENT_STATUS_KEY[status ?? 'UNKNOWN'] ?? PAYMENT_STATUS_KEY.UNKNOWN!;
}

export function invoiceStatusKey(status: string | null | undefined): MessageKey | null {
  if (!status) return null;
  return INVOICE_STATUS_KEY[status] ?? null;
}

export function deliveryTypeKey(type: string | null | undefined): MessageKey | null {
  if (!type) return null;
  return DELIVERY_TYPE_KEY[type] ?? null;
}

/** CSS color token per payment status (pill tint). */
export const PAYMENT_STATUS_TOKEN: Record<string, string> = {
  COMPLETED: 'var(--success)',
  PENDING: 'var(--warning)',
  PENDING_VERIFICATION: 'var(--warning)',
  FAILED: 'var(--error)',
  REFUNDED: 'var(--sw-neutral-500)',
  PARTIALLY_REFUNDED: 'var(--sw-neutral-500)',
  UNKNOWN: 'var(--warning)',
};

/** CSS color token per invoice status (pill tint). */
export const INVOICE_STATUS_TOKEN: Record<string, string> = {
  DRAFT: 'var(--warning)',
  ISSUED: 'var(--warning)',
  PAID: 'var(--success)',
  PARTIALLY_PAID: 'var(--warning)',
  PARTIALLY_REFUNDED: 'var(--sw-neutral-500)',
  REFUNDED: 'var(--sw-neutral-500)',
  VOID: 'var(--error)',
};

/** Invoice statuses that allow the "pay now" flow. */
export function isInvoicePayable(status: string | null | undefined): boolean {
  return status === 'DRAFT' || status === 'ISSUED' || status === 'PARTIALLY_PAID';
}

/** Booking statuses that never offer "pay now" (terminal, or awaiting a staff decision). */
const NON_PAYABLE_BOOKING_STATUSES = ['CANCELLED', 'EXPIRED', 'NO_SHOW', 'COMPLETED', 'CANCEL_REQUESTED'];

/** A booking is payable only with a payable invoice and a non-terminal status. */
export function isBookingPayable(booking: {
  status: string;
  invoiceId?: string | null;
  invoiceStatus?: string | null;
}): boolean {
  return (
    !!booking.invoiceId &&
    isInvoicePayable(booking.invoiceStatus) &&
    !NON_PAYABLE_BOOKING_STATUSES.includes(booking.status)
  );
}

/** Cancelled-like bookings carry no meaningful "unpaid" state, so the badge is hidden. */
export function isBookingVoided(status: string): boolean {
  return ['CANCELLED', 'EXPIRED', 'NO_SHOW', 'CANCEL_REQUESTED'].includes(status);
}
