/**
 * Invoice Types — Sawaa Dashboard
 */

import type { PaginatedQuery } from "./common"

/* ─── Entities ─── */

export interface Invoice {
  id: string
  invoiceNumber: string
  paymentId: string
  subtotal: number
  taxAmount: number
  totalAmount: number
  qrCode: string | null
  sentAt: string | null
  createdAt: string
  updatedAt: string
  payment?: {
    id: string
    method: string
    status: string
    booking?: {
      id: string
      date: string
      client: { firstName: string; lastName: string } | null
      employee: {
        user: { firstName: string; lastName: string }
      }
      service: { nameAr: string; nameEn: string }
    }
  }
}

export interface InvoiceStats {
  total: number
  totalAmount: number
  submitted: number
  accepted: number
  rejected: number
  pending: number
}

/* ─── Query ─── */

export interface InvoiceListQuery extends PaginatedQuery {
  search?: string
  dateFrom?: string
  dateTo?: string
}

/* ─── DTOs ─── */

/**
 * Flat list-row type used when we render payment data as invoice rows
 * (no dedicated list-invoices endpoint yet, so we adapt Payment fields).
 */
export interface InvoiceListItem {
  id: string
  invoiceNumber: string
  clientName: string | null
  totalAmount: number
  taxAmount: number
  createdAt: string
  status: string
  sentAt: string | null
}

export interface CreateInvoicePayload {
  paymentId: string
}
