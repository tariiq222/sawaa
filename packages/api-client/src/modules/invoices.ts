import { apiRequest } from '../client'
import { buildQueryString } from '../types/api'
import type {
  InvoiceListItem,
  InvoiceListQuery,
  InvoiceListResponse,
  InvoiceStats,
} from '../types/invoice'

export async function list(
  query: InvoiceListQuery = {},
): Promise<InvoiceListResponse> {
  return apiRequest<InvoiceListResponse>(
    `/invoices${buildQueryString(query as Record<string, unknown>)}`,
  )
}

export async function stats(): Promise<InvoiceStats> {
  return apiRequest<InvoiceStats>('/invoices/stats')
}

export async function get(id: string): Promise<InvoiceListItem> {
  return apiRequest<InvoiceListItem>(`/invoices/${id}`)
}

/**
 * Returns the relative path to the HTML invoice endpoint.
 * The backend serves the HTML directly (text/html content-type),
 * so the consumer should embed/open this URL rather than parse JSON.
 */
export function getHtmlPath(id: string): string {
  return `/invoices/${id}/html`
}
