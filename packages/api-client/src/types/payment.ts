import type { PaginatedResponse, PaginationParams } from './api'

// Aligned with backend Prisma enum `PaymentMethod` in finance.prisma (UPPER_CASE).
export type PaymentMethod =
  | 'ONLINE_CARD'
  | 'BANK_TRANSFER'
  | 'CASH'
  | 'COUPON'
  | 'MADA'
  | 'TABBY'

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
  historical: {
    collectedCount: number
    collectedAmount: number
    reviewCount: number
    reviewAmount: number
  }
}

export interface PaymentListQuery extends PaginationParams {
  search?: string
  status?: PaymentStatus
  method?: PaymentMethod
  dateFrom?: string
  dateTo?: string
}

export type PaymentListResponse = PaginatedResponse<PaymentListItem>

// Mirrors the invoice shape returned by POST /dashboard/finance/bookings/:bookingId/collect
// (and the standalone ensure-invoice endpoint). All amounts are integer halalas.
export interface EnsuredBookingInvoice {
  id: string
  subtotal: number
  vatRate: number
  total: number
  outstanding: number
  status: string
}

/**
 * Response of the unified booking collection endpoint
 * (POST /dashboard/finance/bookings/:bookingId/collect). `payment` is null when
 * the call only adjusted the discount without moving money. All amounts are
 * integer halalas.
 */
export interface CollectBookingPaymentResult {
  bookingId: string
  invoice: EnsuredBookingInvoice
  payment: { id: string; amount: number; method: string; status: string } | null
}
