import type { PaginatedResponse, PaginationParams } from './api'

/**
 * Booking status values (snake_case in UI/API, mapped to UPPER_CASE in the DB
 * enum). This runtime tuple is the single source of truth for `BookingStatus`;
 * it mirrors the backend `BookingStatus` enum in apps/backend/openapi.json.
 * Keep the two in sync — the colocated booking.test.ts enforces this against
 * the committed OpenAPI spec (the enum-drift gate).
 */
export const BOOKING_STATUSES = [
  'pending',
  'pending_group_fill',
  'awaiting_payment',
  'deposit_paid',
  'confirmed',
  'cancelled',
  'completed',
  'no_show',
  'expired',
  'cancel_requested',
] as const

export type BookingStatus = (typeof BOOKING_STATUSES)[number]

/**
 * Booking kind (snake_case in UI/API, mapped to UPPER_CASE in DB).
 * individual -> INDIVIDUAL
 * walk_in -> WALK_IN
 * group -> GROUP
 */
export type BookingType = 'individual' | 'walk_in' | 'group'

/**
 * Delivery channel — independent from BookingType.
 * IN_PERSON = physically at the branch; ONLINE = virtual (Zoom or other).
 */
export type DeliveryType = 'IN_PERSON' | 'ONLINE'

/** Values returned by the dashboard booking mapper (distinct from request enums). */
export type BookingResponseType = 'in_person' | 'walk_in' | 'group'
export type BookingResponseDeliveryType = 'in_person' | 'online'

/**
 * Origin of a booking — mirrors the backend Prisma `BookingSource` enum.
 * RECEPTION = created by staff at the front desk (dashboard / mobile-employee).
 * ONLINE    = self-service booking from the public website.
 */
export type BookingSource = 'RECEPTION' | 'ONLINE'

export interface BookingListItem {
  id: string
  date: string | null
  startTime: string | null
  endTime: string | null
  status: BookingStatus
  type: BookingResponseType
  deliveryType: BookingResponseDeliveryType | null
  checkedInAt: string | null
  notes: string | null
  adminNotes: string | null
  isLateEntry?: boolean
  lateEntryRecordedAt?: string | null
  lateEntryRecordedBy?: string | null
  lateEntryRecordedByName?: string | null
  createdAt: string
  client: {
    id: string
    firstName: string
    lastName: string
    phone: string | null
  } | null
  employee: {
    id: string
    user: { firstName: string; lastName: string }
    specialty: string | null
    specialtyAr: string | null
  } | null
  service: { id: string; nameAr: string; nameEn: string; price: number; duration: number } | null

  // ─── Snapshot fields (denormalized at booking creation for stable history) ───
  priceSnapshot: number | null
  durationMinutesSnapshot: number | null
  branchNameSnapshot: string | null
  categoryNameSnapshot: string | null
}

/** Dashboard write endpoints return a Prisma booking row, not mapBookingRow. */
export interface BookingWriteResult {
  id: string
  status: Uppercase<BookingStatus>
}

export interface BookingStats {
  total: number
  today: number
  pending: number
  confirmed: number
  completed: number
  cancelled: number
}

export interface BookingListQuery extends PaginationParams {
  status?: BookingStatus
  /** Filter by booking kind (INDIVIDUAL / GROUP / WALK_IN on the backend). */
  bookingType?: BookingType
  /** Filter by delivery channel (IN_PERSON / ONLINE on the backend). */
  deliveryType?: DeliveryType
  employeeId?: string
  clientId?: string
  branchId?: string
  serviceId?: string
  /** Filter by booking origin (RECEPTION / ONLINE on the backend). */
  source?: BookingSource
  /** Return bookings on or after this date (ISO 8601). */
  fromDate?: string
  /** Return bookings on or before this date (ISO 8601). */
  toDate?: string
  /** Filter guest (online) vs walk-in bookings. */
  isGuest?: boolean
  isLateEntry?: boolean
}

export interface CreateBookingPayload {
  employeeId: string
  serviceId: string
  /** Booking kind (INDIVIDUAL/GROUP/WALK_IN in the backend). */
  type?: BookingType
  /** Delivery channel (IN_PERSON or ONLINE). */
  deliveryType?: DeliveryType
  date: string
  startTime: string
  clientId?: string
  notes?: string
  branchId?: string
  durationOptionId?: string
  payAtClinic?: boolean
  couponCode?: string
}

export type BookingListResponse = PaginatedResponse<BookingListItem>

/** Staff-only command. All monetary numbers are integer halalas; timestamps are ISO 8601. */
export interface RecordLateSessionPayload {
  clientId: string
  branchId: string
  employeeId: string
  serviceId: string
  deliveryType: DeliveryType
  scheduledAt: string
  durationMins: number
  status: 'COMPLETED' | 'CONFIRMED' | 'NO_SHOW' | 'CANCELLED'
  amountHalalas: number
  notes?: string
  paymentMode: 'UNPAID' | 'PREVIOUSLY_RECEIVED' | 'COLLECT_NOW'
  paymentMethod?: 'CASH' | 'BANK_TRANSFER' | 'MADA' | 'TABBY'
  paymentAmountHalalas?: number
  receivedAt?: string
  receiptEvidenceRef?: string
  receiptEntryReason?: string
  cancelledAt?: string
  cancellationReason?: string
  noShowAt?: string
  creationIdempotencyKey: string
}

/** Financial amounts are integer halalas, without a client-side currency conversion. */
export interface RecordLateSessionResponse {
  booking: BookingListItem
  invoice: { id: string; subtotal: number; vatRate: number; total: number; status: string } | null
  payment: {
    id: string; amount: number; method: string; status: string
    createdAt: string; processedAt: string | null
    effectiveReceivedAt: string | null
    receiptRecordedBy: string | null
    receiptEvidenceRef: string | null
    receiptEntryReason: string | null
  } | null
  outstanding: number
  isLateEntry: true
  lateEntryRecordedAt: string
  lateEntryRecordedBy: string
}

/** Current server financial settings for the staff late-entry form. */
export interface LateSessionContext {
  vatRate: number
  paymentMethods: Array<'CASH' | 'BANK_TRANSFER' | 'MADA' | 'TABBY'>
}
