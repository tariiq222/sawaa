import type { PaginatedResponse, PaginationParams } from './api'

export interface EmployeeListItem {
  id: string
  isActive: boolean
  rating: number
  reviewCount: number
  experience: number
  bio: string | null
  bioAr: string | null
  createdAt: string
  user: {
    id: string
    firstName: string
    lastName: string
    email: string
    phone: string | null
    avatarUrl: string | null
  }
  specialty: string | null
  specialtyAr: string | null
}

export interface EmployeeStats {
  total: number
  active: number
  inactive: number
  newThisMonth: number
}

export interface EmployeeListQuery extends PaginationParams {
  isActive?: boolean
}

export interface CreateEmployeePayload {
  userId: string
  specialty: string
  specialtyAr?: string
  experience: number
  bio?: string
  bioAr?: string
}

export interface UpdateEmployeePayload {
  specialty?: string
  specialtyAr?: string
  experience?: number
  bio?: string
  bioAr?: string
  isActive?: boolean
}

export type EmployeeListResponse = PaginatedResponse<EmployeeListItem>

// ─── Breaks ────────────────────────────────────────────────────────────────

export interface EmployeeBreak {
  id: string
  employeeId: string
  dayOfWeek: number
  startTime: string
  endTime: string
}

export interface BreakSlotInput {
  dayOfWeek: number
  startTime: string
  endTime: string
}

export interface SetBreaksPayload {
  breaks: BreakSlotInput[]
}

// ─── Vacations ─────────────────────────────────────────────────────────────

export interface EmployeeVacation {
  id: string
  employeeId: string
  startDate: string
  endDate: string
  reason: string | null
  createdAt: string
}

export interface CreateVacationPayload {
  startDate: string
  endDate: string
  reason?: string
}

// ─── Employee Services ─────────────────────────────────────────────────

export interface EmployeeDurationOption {
  id: string
  label: string
  labelAr: string | null
  durationMinutes: number
  price: number
  isDefault: boolean
  sortOrder: number
}

export interface EmployeeTypeConfig {
  id: string
  bookingType: 'in_person' | 'online'
  price: number | null
  duration: number | null
  useCustomOptions: boolean
  isActive: boolean
  durationOptions: EmployeeDurationOption[]
}

export interface EmployeeService {
  id: string
  employeeId: string
  serviceId: string
  customDuration: number | null
  bufferMinutes: number
  availableTypes: string[]
  isActive: boolean
  service: {
    id: string
    nameAr: string
    nameEn: string
    price: number
    duration: number
  }
  types: EmployeeTypeConfig[]
}

export interface AssignEmployeeServicePayload {
  serviceId: string
  customDuration?: number
  bufferMinutes?: number
  availableTypes: string[]
  isActive?: boolean
  types?: EmployeeTypeConfigInput[]
}

export interface UpdateEmployeeServicePayload {
  customDuration?: number | null
  bufferMinutes?: number
  availableTypes?: string[]
  isActive?: boolean
  types?: EmployeeTypeConfigInput[]
}

export interface EmployeeTypeConfigInput {
  bookingType: 'in_person' | 'online'
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
