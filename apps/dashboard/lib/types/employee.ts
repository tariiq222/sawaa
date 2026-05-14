/**
 * Employee Types — Deqah Dashboard
 */

import type { SearchableQuery } from "./common"

/* ─── Entities ─── */

export interface Employee {
  id: string
  userId: string
  title: string | null
  nameAr: string | null
  specialty: string
  specialtyAr: string | null
  bio: string | null
  bioAr: string | null
  experience: number | null
  education: string | null
  educationAr: string | null
  isActive: boolean
  isAcceptingBookings?: boolean
  priceClinic?: number | null
  pricePhone?: number | null
  priceVideo?: number | null
  avatarUrl?: string | null
  slug?: string | null
  isPublic?: boolean
  publicBioAr?: string | null
  publicBioEn?: string | null
  publicImageUrl?: string | null
  createdAt: string
  updatedAt: string
  user: {
    id: string
    firstName: string
    lastName: string
    email: string
    phone: string | null
  }
  _count?: {
    bookings: number
    ratings: number
  }
  averageRating?: number
  ratingCount?: number
  bookingCount?: number
  branchIds?: string[]
  serviceIds?: string[]
}

export interface AvailabilitySlot {
  dayOfWeek: number
  startTime: string
  endTime: string
  isActive: boolean
}

export interface Vacation {
  id: string
  startDate: string
  endDate: string
  reason: string | null
  createdAt: string
}

export interface EmployeeService {
  id: string
  serviceId: string
  customDuration: number | null
  bufferMinutes: number
  availableTypes: string[]
  isActive: boolean
  priceClinic?: number | null
  pricePhone?: number | null
  priceVideo?: number | null
  service: {
    id: string
    nameAr: string
    nameEn: string
    price: number
    duration: number
  }
  serviceTypes?: EmployeeServiceType[]
}

export interface EmployeeServiceType {
  id: string
  employeeServiceId: string
  bookingType: string
  price: number | null
  duration: number | null
  useCustomOptions: boolean
  isActive: boolean
  durationOptions: EmployeeDurationOption[]
}

export interface EmployeeDurationOption {
  id: string
  employeeServiceTypeId: string
  label: string
  labelAr: string | null
  durationMinutes: number
  price: number // halalat
  isDefault: boolean
  sortOrder: number
}

export interface EmployeeTypeConfigPayload {
  bookingType: string
  price?: number | null
  duration?: number | null
  useCustomOptions?: boolean
  isActive?: boolean
  durationOptions?: {
    label: string
    labelAr?: string
    durationMinutes: number
    price: number
    isDefault?: boolean
    sortOrder?: number
  }[]
}

export interface BreakSlot {
  id?: string
  dayOfWeek: number
  startTime: string
  endTime: string
}

export interface TimeSlot {
  startTime: string
  endTime: string
}

/* ─── Query ─── */

export type EmployeeSortField = "name" | "experience" | "isActive" | "createdAt"

export interface EmployeeListQuery extends SearchableQuery {
  minRating?: number
  isActive?: boolean
  sortBy?: EmployeeSortField
  sortOrder?: "asc" | "desc"
}

/* ─── DTOs ─── */

export interface CreateEmployeePayload {
  userId: string
  specialty: string
  specialtyAr?: string
  bio?: string
  bioAr?: string
  experience?: number
  education?: string
  educationAr?: string
  avatarUrl?: string | null
}

export interface UpdateEmployeePayload {
  title?: string
  nameAr?: string
  nameEn?: string
  email?: string
  phone?: string
  gender?: "MALE" | "FEMALE"
  employmentType?: "FULL_TIME" | "PART_TIME" | "CONTRACT"
  specialty?: string
  specialtyAr?: string
  bio?: string
  bioAr?: string
  experience?: number
  education?: string
  educationAr?: string
  isActive?: boolean
  avatarUrl?: string | null
  slug?: string | null
  isPublic?: boolean
  publicBioAr?: string | null
  publicBioEn?: string | null
  publicImageUrl?: string | null
}

export interface SetAvailabilityPayload {
  schedule: AvailabilitySlot[]
}

export interface CreateVacationPayload {
  startDate: string
  endDate: string
  reason?: string
}

export interface SetBreaksPayload {
  breaks: Omit<BreakSlot, "id">[]
}

export interface AssignServicePayload {
  serviceId: string
  customDuration?: number
  bufferMinutes?: number
  availableTypes: string[]
  isActive?: boolean
  types?: EmployeeTypeConfigPayload[]
}

export interface UpdateServicePayload {
  customDuration?: number | null
  bufferMinutes?: number
  availableTypes?: string[]
  isActive?: boolean
  types?: EmployeeTypeConfigPayload[]
}

export interface OnboardEmployeePayload {
  title?: string
  nameEn: string
  nameAr: string
  email: string
  phone?: string
  gender?: "MALE" | "FEMALE"
  employmentType?: "FULL_TIME" | "PART_TIME" | "CONTRACT"
  specialty: string
  specialtyAr?: string
  bio?: string
  bioAr?: string
  experience?: number
  education?: string
  educationAr?: string
  avatarUrl?: string | null
  isActive?: boolean
}

export interface OnboardEmployeeResponse {
  success: boolean
  message: string
  employee: Employee
}
