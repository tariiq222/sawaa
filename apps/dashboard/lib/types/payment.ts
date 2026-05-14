/**
 * Payment Types — Deqah Dashboard
 */

import type {
  PaginatedQuery,
  PaymentMethod,
  PaymentStatus,
  TransferVerificationStatus,
} from "./common"

/* ─── Entities ─── */

export interface Payment {
  id: string
  bookingId: string
  amount: number
  vatAmount: number
  totalAmount: number
  method: PaymentMethod
  status: PaymentStatus
  moyasarPaymentId: string | null
  transactionRef: string | null
  createdAt: string
  updatedAt: string
  booking?: {
    id: string
    date: string
    type: string
    client: { firstName: string; lastName: string; email: string } | null
    employee: {
      user: { firstName: string; lastName: string }
      specialty: { nameAr: string; nameEn: string } | null
    }
    service: { nameAr: string; nameEn: string }
  }
  receipts?: BankTransferReceipt[]
}

export interface BankTransferReceipt {
  id: string
  receiptUrl: string
  aiVerificationStatus: TransferVerificationStatus
  aiConfidence: number | null
  aiNotes: string | null
  adminNotes: string | null
  reviewedAt: string | null
  createdAt: string
}

export interface PaymentStats {
  total: number
  totalAmount: number
  pending: number
  pendingAmount: number
  pendingVerification: number
  pendingVerificationAmount: number
  completed: number
  completedAmount: number
  refunded: number
  refundedAmount: number
  failed: number
}

/* ─── Query ─── */

export interface PaymentListQuery extends PaginatedQuery {
  search?: string
  status?: PaymentStatus
  method?: PaymentMethod
  dateFrom?: string
  dateTo?: string
}

/* ─── DTOs ─── */

export interface RefundPayload {
  amount?: number
  reason: string
}

export interface UpdatePaymentStatusPayload {
  status: PaymentStatus
  moyasarPaymentId?: string
  transactionRef?: string
}

export interface VerifyBankTransferPayload {
  action: "approve" | "reject"
  adminNotes?: string
}

export interface ReviewReceiptPayload {
  approved: boolean
  adminNotes?: string
}
