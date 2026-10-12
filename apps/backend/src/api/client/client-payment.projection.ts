import type { ListPaymentsHandler } from '../../modules/finance/list-payments/list-payments.handler';

type StaffPaymentRow = Awaited<ReturnType<ListPaymentsHandler['execute']>>['items'][number];

/**
 * Explicit allow-list (docs/architecture/client-api-unification.md §3.3): the
 * dashboard handler returns staff-shaped rows (client PII, gatewayRef,
 * receipt/audit/lease fields). Only what client apps consume leaves the API.
 */
export function projectClientPayment(p: StaffPaymentRow) {
  return {
    id: p.id,
    number: p.number,
    invoiceId: p.invoiceId,
    amount: p.amount,
    currency: p.currency,
    method: p.method,
    status: p.status,
    createdAt: p.createdAt,
    processedAt: p.processedAt,
    collectionDate: p.collectionDate,
    invoice: p.invoice ? { bookingId: p.invoice.bookingId, total: p.invoice.total } : null,
  };
}
