import type { PaginatedResponse, PaginationParams } from './api'

export type BookingStatus =
  | 'pending'
  | 'pending_group_fill'
  | 'awaiting_payment'
  | 'confirmed'
  | 'cancelled'
  | 'completed'
  | 'no_show'
  | 'expired'
  | 'cancel_requested'

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

export interface BookingListItem {
  id: string
  date: string
  startTime: string
  endTime: string
  status: BookingStatus
  type: BookingType
  deliveryType: DeliveryType | null
  checkedInAt: string | null
  isWalkIn: boolean
  bookedPrice: number | null
  notes: string | null
  adminNotes: string | null
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
  }
  service: { nameAr: string; nameEn: string; price: number; duration: number }

  // ─── Snapshot fields (denormalized at booking creation for stable history) ───
  priceSnapshot: number | null
  durationMinutesSnapshot: number | null
  branchNameSnapshot: string | null
  employeeNameSnapshot: string | null
  serviceNameSnapshot: string | null
  categoryNameSnapshot: string | null
  departmentNameSnapshot: string | null
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
  type?: BookingType
  employeeId?: string
  clientId?: string
  dateFrom?: string
  dateTo?: string
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
