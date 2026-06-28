/**
 * Booking Types — Sawaa Dashboard
 *
 * Matches the backend Prisma schema + API response shapes.
 */

/**
 * Source of truth: shared/enums/booking.ts (TypeScript enums, UPPER_CASE)
 * Dashboard uses string union types (snake_case) for direct JSON compatibility.
 * Keep these in sync with the Prisma schema and shared/enums/booking.ts.
 */

/* ─── Enums ─── */

export type DeliveryType = "IN_PERSON" | "ONLINE"

export type BookingType = "individual" | "group" | "walk_in"

export type BookingSource = "RECEPTION" | "ONLINE"

export type BookingStatus =
  | "pending"
  | "pending_group_fill"
  | "awaiting_payment"
  | "deposit_paid"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show"
  | "expired"
  | "cancel_requested"

export type RefundType = "full" | "partial" | "none"

export type CancelledBy = "client" | "employee" | "admin" | "system"

/* ─── Entities ─── */

export interface BookingClient {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
}

export interface BookingEmployee {
  id: string
  userId: string
  user: { firstName: string; lastName: string }
  specialty: string
  specialtyAr: string
}

export interface BookingService {
  id: string
  nameAr: string
  nameEn: string
  price: number
  duration: number
}

export interface BookingPayment {
  id: string
  amount: number
  method: "moyasar" | "bank_transfer" | "cash" | "mada" | "tabby"
  status: "pending" | "awaiting" | "paid" | "failed" | "refunded" | "rejected"
  totalAmount: number
}

export interface BookingInvoice {
  id: string
  subtotal: number    // halalas, net before VAT/discount
  vatRate: number     // fractional rate, e.g. 0.15
  total: number       // halalas, after discount
  outstanding: number // halalas, total minus completed payments
  status: string      // Prisma InvoiceStatus
}

export interface RescheduledFrom {
  id: string
  date: string
  startTime: string
}

/* ─── Main Booking ─── */

export interface Booking {
  id: string
  bookingNumber: number
  clientId: string | null
  employeeId: string
  serviceId: string
  employeeServiceId: string
  type: BookingType
  deliveryType: DeliveryType | null
  source: BookingSource
  date: string
  startTime: string
  endTime: string
  status: BookingStatus
  checkedInAt: string | null
  notes: string | null
  zoomJoinUrl: string | null
  zoomHostUrl: string | null
  zoomMeetingStatus: "PENDING" | "CREATED" | "FAILED" | "CANCELLED" | null
  zoomMeetingError: string | null
  cancellationReason: string | null
  cancelledBy: CancelledBy | null
  suggestedRefundType: RefundType | null
  adminNotes: string | null
  cancelledAt: string | null
  confirmedAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
  client: BookingClient | null
  employee: BookingEmployee
  service: BookingService
  employeeService: { id: string } | null
  rescheduledFrom: RescheduledFrom | null
  payment: BookingPayment | null
  invoice: BookingInvoice | null
  intakeFormId: string | null
  intakeFormAlreadySubmitted: boolean
  // ─── Snapshot fields (denormalized at booking creation) ───
  priceSnapshot: number | null
  durationMinutesSnapshot: number | null
  branchNameSnapshot: string | null
  employeeNameSnapshot: string | null
  serviceNameSnapshot: string | null
  categoryNameSnapshot: string | null
  departmentNameSnapshot: string | null
}

/* ─── Query / Request DTOs ─── */

export interface BookingListQuery {
  page?: number
  limit?: number
  status?: BookingStatus
  type?: BookingType
  deliveryType?: DeliveryType
  employeeId?: string
  clientId?: string
  dateFrom?: string
  dateTo?: string
  search?: string
  isGuest?: boolean
}

export interface CreateBookingPayload {
  clientId?: string
  employeeId: string
  serviceId: string
  type: BookingType
  deliveryType: DeliveryType
  durationOptionId?: string
  date: string
  startTime: string
  notes?: string
  payAtClinic?: boolean
  branchId?: string
  couponCode?: string
}

export interface ReschedulePayload {
  date?: string
  startTime?: string
}

/** Wire format of the backend RefundType enum (uppercase). */
export type RefundDecision = "FULL" | "PARTIAL" | "NONE"

export interface CancelApprovePayload {
  approverNotes?: string
  refundType?: RefundDecision
  /** Halalas — only sent when refundType is PARTIAL. */
  refundAmount?: number
}

export interface CancelRejectPayload {
  adminNotes?: string
}

export type CancellationReason =
  | "CLIENT_REQUESTED"
  | "EMPLOYEE_UNAVAILABLE"
  | "NO_SHOW"
  | "SYSTEM_EXPIRED"
  | "OTHER"

export interface AdminCancelPayload {
  reason: CancellationReason
  cancelNotes?: string
}

export interface EmployeeCancelPayload {
  reason: string
}

export interface CancelRequestPayload {
  reason?: string
}

export interface ClientReschedulePayload {
  date?: string
  startTime?: string
}

/* ─── Stats ─── */

export interface BookingStats {
  total: number
  confirmed: number
  pending: number
  completed: number
  cancelled: number
  cancelRequested: number
  noShow: number
  expired: number
}
