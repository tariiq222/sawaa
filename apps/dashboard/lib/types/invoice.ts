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

/* ─── Invoice status (mirrors backend InvoiceStatus enum) ─── */

export type InvoiceStatus =
  | "DRAFT"
  | "ISSUED"
  | "PAID"
  | "PARTIALLY_PAID"
  | "PARTIALLY_REFUNDED"
  | "VOID"
  | "REFUNDED"

/* ─── Query ─── */

export interface InvoiceListQuery extends PaginatedQuery {
  /** Page size sent to the backend list endpoint (mirrors PaginationDto.limit). */
  limit?: number
  search?: string
  status?: InvoiceStatus
  clientId?: string
  bookingId?: string
  dateFrom?: string
  dateTo?: string
}

/* ─── DTOs ─── */

/**
 * Raw row returned by GET /dashboard/finance/invoices. Monetary fields are
 * integer halalas serialized by Prisma Decimal (string over the wire).
 */
export interface InvoiceListRow {
  id: string
  number: number
  clientId: string
  bookingId: string | null
  clientName: string | null
  subtotal: string | number
  vatAmt: string | number
  total: string | number
  refundedAmount: string | number
  currency: string
  status: InvoiceStatus
  issuedAt: string | null
  paidAt: string | null
  sentToClientAt: string | null
  hasPdf: boolean
  createdAt: string
}

/**
 * Flat list-row type consumed by the invoice table + columns.
 */
export interface InvoiceListItem {
  id: string
  invoiceNumber: string
  clientName: string | null
  totalAmount: number
  taxAmount: number | null
  createdAt: string
  status: InvoiceStatus
  sentAt: string | null
  hasPdf: boolean
}

export interface CreateInvoicePayload {
  paymentId: string
}
