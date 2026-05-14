/**
 * Common Types — Deqah Dashboard
 *
 * Shared types used across all modules.
 */

/* ─── API Response ─── */

export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
  error?: { code: string; message: string }
}

export interface PaginatedResponse<T> {
  items: T[]
  meta: PaginationMeta
}

export interface PaginationMeta {
  total: number
  page: number
  perPage: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

/* ─── Common Query Params ─── */

export interface PaginatedQuery {
  page?: number
  perPage?: number
}

export interface SortableQuery extends PaginatedQuery {
  sortBy?: string
  sortOrder?: "asc" | "desc"
}

export interface SearchableQuery extends SortableQuery {
  search?: string
}

/* ─── Enums ─── */

export type UserGender = "male" | "female"

export type PaymentMethod = "moyasar" | "bank_transfer" | "cash"

export type PaymentStatus =
  | "pending"
  | "awaiting"
  | "paid"
  | "refunded"
  | "failed"
  | "rejected"

export type TransferVerificationStatus =
  | "pending"
  | "matched"
  | "amount_differs"
  | "suspicious"
  | "old_date"
  | "unreadable"
  | "approved"
  | "rejected"

export type NotificationType =
  | "booking_confirmed"
  | "booking_completed"
  | "booking_cancelled"
  | "booking_rescheduled"
  | "booking_expired"
  | "booking_no_show"
  | "booking_reminder"
  | "booking_reminder_urgent"
  | "booking_cancellation_rejected"
  | "cancellation_rejected"
  | "cancellation_requested"
  | "no_show_review"
  | "client_arrived"
  | "receipt_rejected"
  | "reminder"
  | "payment_received"
  | "new_rating"
  | "problem_report"
  | "waitlist_slot_available"
  | "system_alert"
