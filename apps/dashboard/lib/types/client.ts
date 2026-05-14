/**
 * Client Types — Deqah Dashboard
 */

import type { PaginatedQuery, UserGender } from "./common"

/* ─── Entities ─── */

export interface ClientBookingPreview {
  id: string
  date: string
  status: string
  service: { nameAr: string; nameEn: string }
  employee: { user: { firstName: string; lastName: string } }
  payment: { totalAmount: number; status: string; method: string } | null
}

export interface Client {
  id: string
  email: string | null
  firstName: string
  middleName?: string | null
  lastName: string
  phone: string | null
  gender: UserGender | null
  name?: string
  nationality?: string | null
  nationalId?: string | null
  dateOfBirth?: string | null
  emergencyName?: string | null
  emergencyPhone?: string | null
  bloodType?: string | null
  allergies?: string | null
  chronicConditions?: string | null
  isActive: boolean
  emailVerified: boolean
  createdAt: string
  updatedAt: string
  accountType?: "FULL" | "WALK_IN" | "full" | "walk_in" | null
  claimedAt?: string | null
  avatarUrl?: string | null
  lastBooking?: { id: string; date: string; status: string } | null
  nextBooking?: { id: string; date: string; status: string } | null
}

export interface ClientStats {
  totalBookings: number
  completedBookings: number
  cancelledBookings: number
  totalSpent: number
  totalPaid?: number
  completedPayments?: number
  lastVisit: string | null
  byStatus?: Record<string, number>
}

/* ─── Query ─── */

export interface ClientListQuery extends PaginatedQuery {
  search?: string
  isActive?: boolean
}
