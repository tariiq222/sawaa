import type { PaginatedResponse, PaginationParams } from './api'

// Aligned with backend Prisma enums (UPPER_CASE).
export type PaymentMethod = 'MOYASAR' | 'BANK_TRANSFER' | 'CASH'

export type PaymentStatus =
  | 'PENDING'
  | 'PENDING_VERIFICATION'
  | 'COMPLETED'
  | 'FAILED'
  | 'REFUNDED'

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

// Mirrors backend GetPaymentStatsHandler return shape.
export interface PaymentStats {
  total: number
  totalAmount: number
  completed: number
  completedAmount: number
  pending: number
  pendingAmount: number
  pendingVerification: number
  pendingVerificationAmount: number
  refunded: number
  refundedAmount: number
  failed: number
}

export interface PaymentListQuery extends PaginationParams {
  status?: PaymentStatus
  method?: PaymentMethod
  dateFrom?: string
  dateTo?: string
}

export type PaymentListResponse = PaginatedResponse<PaymentListItem>
