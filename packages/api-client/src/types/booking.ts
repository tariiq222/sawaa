import type { components, paths } from './generated/openapi'
import type { PaginatedResponse, PaginationParams } from './api'

type Schemas = components['schemas']
type BookingRow = Schemas['BookingRowDto']
type BookingListQueryDoc = NonNullable<
  paths['/api/v1/dashboard/bookings']['get']['parameters']['query']
>

/**
 * Booking status values (snake_case in UI/API, mapped to UPPER_CASE in the DB
 * enum). This runtime tuple is the single source of truth for the runtime
 * vocabulary; `BookingStatus` is DERIVED from the snapshot's `BookingStatus`
 * enum and the two are pinned equal by the compile-time checks below.
 * The colocated booking.test.ts still enforces the tuple against the committed
 * OpenAPI spec at runtime (the enum-drift gate).
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

/** `BookingStatus` enum from the snapshot, lower-cased to the UI vocabulary. */
export type BookingStatus = Lowercase<Schemas['BookingStatus']>

// Compile-time parity guard: if the snapshot enum and the runtime tuple diverge,
// one of these stops compiling (the test also checks it at runtime).
type _StatusEnumCoversTuple = (typeof BOOKING_STATUSES)[number] extends BookingStatus ? true : never
type _StatusTupleCoversEnum = BookingStatus extends (typeof BOOKING_STATUSES)[number] ? true : never
const _statusEnumCoversTuple: _StatusEnumCoversTuple = true
const _statusTupleCoversEnum: _StatusTupleCoversEnum = true
void _statusEnumCoversTuple
void _statusTupleCoversEnum

/**
 * Booking kind (snake_case UI/API; the snapshot's `BookingType` is UPPER_CASE).
 * individual -> INDIVIDUAL, walk_in -> WALK_IN, group -> GROUP.
 */
export type BookingType = Lowercase<Schemas['BookingType']>

/** Delivery channel — the snapshot's `DeliveryType` already uses this vocabulary. */
export type DeliveryType = Schemas['DeliveryType']

/** Values returned by the dashboard booking mapper (from `BookingRowDto['type']`). */
export type BookingResponseType = BookingRow['type']
export type BookingResponseDeliveryType = NonNullable<BookingRow['deliveryType']>

/**
 * Origin of a booking. Derived from the snapshot's `BookingSource` but
 * deliberately projected to the two values this client sends/filters on; the
 * enum also carries server-originated `WHATSAPP`/`AI_CHAT` values.
 */
export type BookingSource = Extract<Schemas['BookingSource'], 'RECEPTION' | 'ONLINE'>

/**
 * Row returned by `GET /api/v1/dashboard/bookings` / `…/{id}`
 * (`BookingRowDto`), projected to the keys this client exposes. `client`,
 * `employee`, `service` are narrowed picks of the documented nested DTOs.
 */
export type BookingListItem = Pick<
  BookingRow,
  | 'id'
  | 'date'
  | 'startTime'
  | 'endTime'
  | 'checkedInAt'
  | 'notes'
  | 'adminNotes'
  | 'createdAt'
  | 'priceSnapshot'
  | 'durationMinutesSnapshot'
  | 'branchNameSnapshot'
  | 'categoryNameSnapshot'
> & {
  /** Collection intent; never a substitute for financial payment status. */
  payAtClinic?: BookingRow['payAtClinic']
  status: BookingStatus
  type: BookingResponseType
  deliveryType: BookingResponseDeliveryType | null
  isLateEntry?: BookingRow['isLateEntry']
  lateEntryRecordedAt?: BookingRow['lateEntryRecordedAt']
  lateEntryRecordedBy?: BookingRow['lateEntryRecordedBy']
  /** Legacy UI key the API never produced; kept for the old component fallback. */
  lateEntryRecordedByName?: string | null
  client:
    | Pick<Schemas['BookingRowClientDto'], 'id' | 'firstName' | 'lastName' | 'phone'>
    | null
  employee:
    | (Pick<Schemas['BookingRowEmployeeDto'], 'id'> & {
        // booking-row.mapper.ts coerces null → '', but the old exported
        // contract allowed null, so it is preserved here.
        specialty: Schemas['BookingRowEmployeeDto']['specialty'] | null
        specialtyAr: Schemas['BookingRowEmployeeDto']['specialtyAr'] | null
        user: Pick<Schemas['BookingRowEmployeeUserDto'], 'firstName' | 'lastName'>
      })
    | null
  service:
    | Pick<Schemas['BookingRowServiceDto'], 'id' | 'nameAr' | 'nameEn' | 'price' | 'duration'>
    | null
}

/**
 * Dashboard write endpoints (create / cancel / confirm / complete) return a
 * Prisma booking row, not the mapped list row. All four operations document a
 * record DTO sharing `id` + UPPER_CASE `status`; `BookingRecordDto` is the
 * common one (`CreatedBookingRecordDto`/`CancelledBookingRecordDto` add keys).
 */
export type BookingWriteResult = Pick<Schemas['BookingRecordDto'], 'id' | 'status'>

/**
 * NOT derived: `GET /dashboard/bookings/stats` documents
 * `BookingsStatsResponseDto` (`todayCount`, `pendingCount`, `completedToday`,
 * `revenueToday`), a different shape from these dashboard counters. No module
 * in this package calls that route. Kept hand-written.
 */
export interface BookingStats {
  total: number
  today: number
  pending: number
  confirmed: number
  completed: number
  cancelled: number
}

/**
 * Query of `GET /api/v1/dashboard/bookings`, plus paging. The snapshot's enum
 * params are UPPER_CASE, while this client sends the lower-case aliases the
 * DTO normalises server-side (`mapBookingStatus`/`mapBookingType`), so those
 * four are re-typed to the UI vocabulary instead of taking the raw enum.
 */
export type BookingListQuery = PaginationParams &
  Omit<BookingListQueryDoc, 'status' | 'bookingType' | 'deliveryType' | 'source'> & {
    status?: BookingStatus
    /** Filter by booking kind (INDIVIDUAL / GROUP / WALK_IN on the backend). */
    bookingType?: BookingType
    /** Filter by delivery channel (IN_PERSON / ONLINE on the backend). */
    deliveryType?: DeliveryType
    /** Filter by booking origin (RECEPTION / ONLINE on the backend). */
    source?: BookingSource
  }

/**
 * NOT derived: `POST /dashboard/bookings` documents `CreateBookingDto`
 * (`scheduledAt`, required `clientId`/`branchId`, `bookingType`). This legacy
 * payload uses `date`/`startTime`/`type` and no module here sends it. Kept
 * hand-written to preserve the exported contract.
 */
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

/** Staff-only command. Request body of `POST /dashboard/bookings/late-entry`. */
export type RecordLateSessionPayload = Schemas['RecordLateSessionDto']

/**
 * 201 body of `POST /dashboard/bookings/late-entry` (`LateEntryResultDto`).
 * Intentionally wider than the old hand-written shape: the handler returns the
 * full documented row/invoice/payment DTOs, and every field the old type
 * declared is present here. Money fields are integer halalas.
 */
export type RecordLateSessionResponse = Schemas['LateEntryResultDto']

/** 200 body of `GET /dashboard/bookings/late-entry/context`. */
export type LateSessionContext = Schemas['GetLateSessionContextResponseDto']
