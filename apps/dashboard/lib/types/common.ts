/**
 * Common Types — Sawaa Dashboard
 *
 * Shared types used across all modules.
 */

// Single source of truth: @sawaa/shared enums (themselves aligned to the
// Prisma schema / openapi.json wire contract). We re-export the string-literal
// union companions (`*Value`) rather than the enum objects, because the
// dashboard compares/assigns raw wire strings (e.g. `status === "COMPLETED"`)
// and TS string enums are nominal — a bare literal is not assignable to them.
import type {
  PaymentMethodValue,
  PaymentStatusValue,
  TransferVerificationStatusValue,
  NotificationTypeValue,
} from "@sawaa/shared/enums"

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
  limit: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

/* ─── Common Query Params ─── */

export interface PaginatedQuery {
  page?: number
  limit?: number
}

export interface SortableQuery extends PaginatedQuery {
  sortBy?: string
  sortOrder?: "asc" | "desc"
}

export interface SearchableQuery extends SortableQuery {
  search?: string
}

/* ─── Enums ─── */

// NOTE — intentional local type, NOT re-exported from @sawaa/shared.
// The wire genuinely diverges by entity: the API returns CLIENT gender as
// lowercase `male`/`female` (openapi `ClientResponseDto.gender`), whereas
// USER/EMPLOYEE gender is UPPERCASE `MALE`/`FEMALE` (openapi `UserGender`,
// matching shared `UserGender` and the uppercase alias in `./user`).
// This alias models the client wire field only; do not unify it with the
// uppercase user/employee gender.
export type UserGender = "male" | "female"

// Re-exported from @sawaa/shared (Prisma/openapi-aligned). Adds MADA/TABBY
// and PARTIALLY_REFUNDED that the previous local copies were missing.
export type PaymentMethod = PaymentMethodValue

export type PaymentStatus = PaymentStatusValue

export type TransferVerificationStatus = TransferVerificationStatusValue

export type NotificationType = NotificationTypeValue
