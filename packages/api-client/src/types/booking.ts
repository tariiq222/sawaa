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
 * Booking type (snake_case in UI/API, mapped to UPPER_CASE in DB).
 * in_person -> INDIVIDUAL
 * online -> ONLINE
 * walk_in -> WALK_IN
 * group -> GROUP
 */
export type BookingType = 'in_person' | 'online' | 'walk_in' | 'group'

export interface BookingListItem {
  id: string
  date: string
  startTime: string
  endTime: string
  status: BookingStatus
  type: BookingType
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
  type: BookingType
  date: string
  startTime: string
  clientId?: string
  notes?: string
  branchId?: string
}

export interface UpdateBookingPayload {
  status?: BookingStatus
  adminNotes?: string
}

export type BookingListResponse = PaginatedResponse<BookingListItem>
