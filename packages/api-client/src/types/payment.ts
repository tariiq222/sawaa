import type { PaginatedResponse, PaginationParams } from './api'

export type PaymentMethod = 'moyasar' | 'bank_transfer' | 'cash'

export type PaymentStatus =
  | 'pending'
  | 'awaiting'
  | 'paid'
  | 'refunded'
  | 'failed'
  | 'rejected'

export interface PaymentBookingClient {
  id: string
  firstName: string
  lastName: string
  phone: string | null
}

export interface PaymentBooking {
  id: string
  date: string
  startTime: string
  client: PaymentBookingClient | null
  service: { id: string; nameAr: string; nameEn: string } | null
}

export interface PaymentInvoice {
  id: string
  invoiceNumber: string
  sentAt: string | null
  vatAmount: number
  vatRate: number
}

export interface PaymentListItem {
  id: string
  bookingId: string | null
  groupEnrollmentId: string | null
  amount: number
  vatAmount: number
  totalAmount: number
  refundAmount: number | null
  refundedAt: string | null
  refundedBy: string | null
  refundReason: string | null
  method: PaymentMethod
  status: PaymentStatus
  moyasarPaymentId: string | null
  transactionRef: string | null
  createdAt: string
  updatedAt: string
  booking?: PaymentBooking | null
  invoice?: PaymentInvoice | null
}

export interface PaymentStats {
  total: number
  paid: number
  pending: number
  failed: number
  refunded: number
  totalRevenue: number
}

export interface PaymentListQuery extends PaginationParams {
  status?: PaymentStatus
  method?: PaymentMethod
  dateFrom?: string
  dateTo?: string
}

export type PaymentListResponse = PaginatedResponse<PaymentListItem>
