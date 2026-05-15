/**
 * Payment Types — Sawaa Dashboard
 *
 * Mirrors the backend Prisma Payment model (finance.prisma).
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
  invoiceId: string
  amount: number
  refundedAmount: number
  currency: string
  method: PaymentMethod
  status: PaymentStatus
  gatewayRef: string | null
  idempotencyKey: string | null
  receiptUrl: string | null
  failureReason: string | null
  processedAt: string | null
  createdAt: string
  updatedAt: string
  invoice?: {
    bookingId: string
    clientId: string
    total: number
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
  gatewayRef?: string
}

export interface VerifyBankTransferPayload {
  action: "approve" | "reject"
  adminNotes?: string
}

export interface ReviewReceiptPayload {
  approved: boolean
  adminNotes?: string
}
