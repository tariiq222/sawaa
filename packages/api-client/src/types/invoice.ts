import type { PaginatedResponse, PaginationParams } from './api'

export interface InvoicePaymentInfo {
  id: string
  amount: number
  totalAmount: number
  status: string
  method: string
  booking?: {
    id: string
    client?: {
      id: string
      firstName: string
      lastName: string
    } | null
  } | null
}

export interface InvoiceListItem {
  id: string
  paymentId: string | null
  groupEnrollmentId: string | null
  invoiceNumber: string
  pdfUrl: string | null
  sentAt: string | null
  vatAmount: number
  vatRate: number
  invoiceHash: string | null
  previousHash: string | null
  qrCodeData: string | null
  createdAt: string
  updatedAt: string
  payment?: InvoicePaymentInfo | null
}

export interface InvoiceStats {
  total: number
  sent: number
  pending: number
}

export interface InvoiceListQuery extends PaginationParams {
  dateFrom?: string
  dateTo?: string
}

export type InvoiceListResponse = PaginatedResponse<InvoiceListItem>
