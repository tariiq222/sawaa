import type { Invoice } from '@prisma/client';
import type { GetPublicInvoiceResult } from './get-public-invoice.handler';

/** Map the stored invoice to the client-facing representation shared by both lookups. */
export function mapInvoiceResult(invoice: Invoice, sellerName: string): GetPublicInvoiceResult {
  return {
    id: invoice.id,
    sellerName,
    branchId: invoice.branchId,
    clientId: invoice.clientId,
    employeeId: invoice.employeeId,
    bookingId: invoice.bookingId,
    packagePurchaseId: invoice.packagePurchaseId,
    subtotal: Number(invoice.subtotal),
    discountAmt: Number(invoice.discountAmt),
    vatRate: Number(invoice.vatRate),
    vatAmt: Number(invoice.vatAmt),
    total: Number(invoice.total),
    refundedAmount: Number(invoice.refundedAmount),
    refundedVatAmt: Number(invoice.refundedVatAmt),
    currency: invoice.currency,
    status: invoice.status,
    issuedAt: invoice.issuedAt?.toISOString() ?? null,
    dueAt: invoice.dueAt?.toISOString() ?? null,
    paidAt: invoice.paidAt?.toISOString() ?? null,
    createdAt: invoice.createdAt.toISOString(),
    // Field name kept for API compatibility; it now carries the paid-receipt key only.
    pdfUrl: invoice.receiptPdfKey ?? null,
  };
}
