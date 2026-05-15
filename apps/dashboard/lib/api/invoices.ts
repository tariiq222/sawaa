/**
 * Invoices API — Sawaa Dashboard
 *
 * Uses the payments endpoint since invoices are returned as part of
 * the payment list response (no dedicated list-invoices endpoint yet).
 */

import { api } from "@/lib/api"
import type { PaginatedResponse } from "@/lib/types/common"
import type { Payment } from "@/lib/types/payment"

export async function fetchInvoicePayments(
  query: { page?: number; limit?: number } = {},
): Promise<PaginatedResponse<Payment>> {
  return api.get<PaginatedResponse<Payment>>("/dashboard/finance/payments", {
    page: query.page,
    limit: query.limit,
  })
}
