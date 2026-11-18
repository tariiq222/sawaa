import type { components } from './generated/openapi'
import type { PaginatedResponse, PaginationParams } from './api'

type Schemas = components['schemas']

/** Aligned with the snapshot's `PaymentMethod` enum (UPPER_CASE). */
export type PaymentMethod = Schemas['PaymentMethod']

/**
 * Payment status. Derived from the snapshot's `PaymentStatus` enum and
 * projected to the five values this client historically exposed; the snapshot
 * also carries `PARTIALLY_REFUNDED`, which this legacy union never included.
 */
export type PaymentStatus = Extract<
  Schemas['PaymentStatus'],
  'PENDING' | 'PENDING_VERIFICATION' | 'COMPLETED' | 'FAILED' | 'REFUNDED'
>

/**
 * NOT derived: no documented schema exposes this nested booking-client
 * projection (`PaymentListRowDto` is flat and carries `invoice.client`). Kept
 * hand-written as the legacy nested shape.
 */
export interface PaymentBookingClient {
  id: string
  firstName: string
  lastName: string
  phone: string | null
}

/** NOT derived: the documented list/detail rows are flat; this is a legacy nested projection. */
export interface PaymentBooking {
  id: string
  date: string
  startTime: string
  client: PaymentBookingClient | null
  service: { id: string; nameAr: string; nameEn: string } | null
}

/** NOT derived: `PaymentListInvoiceSummaryDto` is `{bookingId, client, clientId, total}`; this legacy shape has no equivalent. */
export interface PaymentInvoice {
  id: string
  invoiceNumber: string
  sentAt: string | null
  vatAmount: number
  vatRate: number
}

/**
 * NOT derived: `GET /dashboard/finance/payments` documents `PaymentListRowDto`
 * (flat, decimal-string money, `number`, nested `invoice` summary), which is a
 * different contract from this legacy nested shape (`vatAmount`,
 * `totalAmount`, `moyasarPaymentId`, `transactionRef`, `booking`, `invoice`).
 * The enum fields are derived from the snapshot below so the union vocabulary
 * still tracks the backend.
 */
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
  collectionDate?: string
  effectiveReceivedAt?: string | null
  receiptRecordedBy?: string | null
  receiptEvidenceRef?: string | null
  receiptEntryReason?: string | null
  processedAt?: string | null
  createdAt: string
  updatedAt: string
  booking?: PaymentBooking | null
  invoice?: PaymentInvoice | null
}

/** 200 body of `GET /dashboard/finance/payments/stats` (`PaymentStatsResponseDto`). */
export type PaymentStats = Schemas['PaymentStatsResponseDto']

/**
 * NOT derived: the documented list operation takes `fromDate`/`toDate`, while
 * this legacy query (and the module's request builder) uses `dateFrom`/
 * `dateTo`. The mismatch is existing runtime behaviour, so the type keeps the
 * old names. `search`/`status`/`method` match the documented operation.
 */
export interface PaymentListQuery extends PaginationParams {
  search?: string
  status?: PaymentStatus
  method?: PaymentMethod
  dateFrom?: string
  dateTo?: string
}

export type PaymentListResponse = PaginatedResponse<PaymentListItem>

/** `POST /dashboard/finance/bookings/{bookingId}/invoice` / collect → `EnsuredInvoiceDto`. */
export type EnsuredBookingInvoice = Schemas['EnsuredInvoiceDto']

/**
 * `POST /dashboard/finance/bookings/{bookingId}/collect` (`PaymentCollectionResponseDto`).
 * `payment` is null when the call only adjusted the discount.
 */
export type CollectBookingPaymentResult = Schemas['PaymentCollectionResponseDto']
