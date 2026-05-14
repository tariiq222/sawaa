/**
 * Waitlist Types — Deqah Dashboard
 */

export type WaitlistStatus =
  | "waiting"
  | "notified"
  | "booked"
  | "expired"
  | "cancelled"

export interface WaitlistEntry {
  id: string
  clientId: string
  employeeId: string
  serviceId: string | null
  preferredDate: string | null
  preferredTime: string | null // "morning" | "afternoon" | "any"
  status: WaitlistStatus
  notifiedAt: string | null
  bookedBookingId: string | null
  createdAt: string
  updatedAt: string
  client: {
    id: string
    firstName: string
    lastName: string
    email: string
    phone: string | null
  }
  employee: {
    id: string
    user: { firstName: string; lastName: string }
  }
  service: {
    id: string
    nameAr: string
    nameEn: string
  } | null
}
