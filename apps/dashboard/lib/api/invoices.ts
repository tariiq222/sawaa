/**
 * Invoices API — Sawaa Dashboard
 *
 * Consumes the dedicated list-invoices endpoint so the Invoices page shows
 * real invoice rows (number, client, totals, VAT, status) rather than payments.
 */

import { api } from "@/lib/api"
import type { PaginatedResponse } from "@/lib/types/common"
import type { InvoiceListRow, InvoiceListQuery } from "@/lib/types/invoice"

export async function fetchInvoices(
  query: InvoiceListQuery = {},
): Promise<PaginatedResponse<InvoiceListRow>> {
  return api.get<PaginatedResponse<InvoiceListRow>>("/dashboard/finance/invoices", {
    page: query.page,
    limit: query.limit,
    status: query.status,
    clientId: query.clientId,
    bookingId: query.bookingId,
    fromDate: query.dateFrom,
    toDate: query.dateTo,
  })
}

/**
 * Resolve the (presigned) download link for an invoice's ZATCA Phase-1 PDF.
 * Returns 404 with a "no PDF generated yet" message when the invoice has no
 * PDF — callers should surface that as a friendly message.
 */
export async function fetchInvoicePdf(id: string): Promise<{ url: string }> {
  return api.get<{ url: string }>(`/dashboard/finance/invoices/${id}/pdf`)
}
