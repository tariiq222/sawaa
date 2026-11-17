/**
 * Invoices API — Sawaa Dashboard
 *
 * Consumes the dedicated list-invoices endpoint so the Invoices page shows
 * real invoice rows (number, client, totals, VAT, status) rather than payments.
 *
 * Response types come from the committed OpenAPI snapshot through
 * `lib/types/invoice.ts`. The list call keeps the plain `api.get(path, params)`
 * transport because it always appended a bare `?` when every value was
 * undefined; the PDF calls have no parameters, so they use the typed helper
 * (`openApi`) and produce the same request bytes.
 */

import { api } from "@/lib/api"
import { openApi } from "@/lib/api/openapi"
import type { InvoiceListPage, InvoiceListQuery, InvoicePdfUrl } from "@/lib/types/invoice"

export async function fetchInvoices(
  query: InvoiceListQuery = {},
): Promise<InvoiceListPage> {
  return api.get<InvoiceListPage>("/dashboard/finance/invoices", {
    page: query.page,
    limit: query.limit,
    search: query.search,
    status: query.status,
    clientId: query.clientId,
    bookingId: query.bookingId,
    fromDate: query.dateFrom,
    toDate: query.dateTo,
  })
}

/**
 * Resolve the (presigned) download link for an invoice's paid receipt.
 * Returns 404 when the invoice has no issued receipt — callers should surface
 * that as a friendly message.
 */
export async function fetchInvoicePdf(id: string): Promise<InvoicePdfUrl> {
  return openApi.get("/api/v1/dashboard/finance/invoices/{id}/pdf", {
    path: { id },
  })
}

/**
 * Generate (or reuse) an invoice's PDF on demand and return a presigned
 * download link. Works for invoices in any status — unlike the auto-generated
 * receipt, which only fires when an invoice is paid in full.
 */
export async function generateInvoicePdf(id: string): Promise<InvoicePdfUrl> {
  // Transport stays on the plain client: the typed helper has no body for this
  // route, while the existing call sends an explicit `{}` and the request must
  // stay byte-identical.
  return api.post<InvoicePdfUrl>(`/dashboard/finance/invoices/${id}/pdf`, {})
}
