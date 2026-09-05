import { InvoiceStatus } from '@prisma/client';

/** Invoice lifecycles that must never be reopened by a new or late payment. */
export function isClosedInvoiceStatus(status: InvoiceStatus): boolean {
  return (
    status === InvoiceStatus.VOID ||
    status === InvoiceStatus.PARTIALLY_REFUNDED ||
    status === InvoiceStatus.REFUNDED
  );
}

/** Invoice lifecycles that cannot accept a new or still-pending payment. */
export function isNonPayableInvoiceStatus(status: InvoiceStatus): boolean {
  return status === InvoiceStatus.PAID || isClosedInvoiceStatus(status);
}
