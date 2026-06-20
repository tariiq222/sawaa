/**
 * Employees API — Sawaa Dashboard
 */

export * from "./employees-schedule"

import { api } from "@/lib/api"
import type { PaginatedResponse } from "@/lib/types/common"
import type {
  Employee,
  EmployeeListQuery,
  CreateEmployeePayload,
  UpdateEmployeePayload,
  OnboardEmployeePayload,
  OnboardEmployeeResponse,
} from "@/lib/types/employee"
import type { ServiceEmployeeServiceType } from "@/lib/types/service"

/* ─── Queries ─── */

export async function fetchEmployees(
  query: EmployeeListQuery = {},
): Promise<PaginatedResponse<Employee>> {
  const res = await api.get<{ data?: RawEmployee[]; items?: RawEmployee[]; meta: PaginatedResponse<RawEmployee>["meta"] }>("/dashboard/people/employees", {
    page: query.page,
    limit: query.perPage,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
    search: query.search,
    minRating: query.minRating,
    isActive: query.isActive,
  })
  const rawItems = res.data ?? res.items ?? []
  return {
    items: rawItems.map(mapEmployee),
    meta: res.meta,
  }
}

/** Backend returns specialty as plain text fields + rating/reviewCount */
type RawEmployee = Omit<Employee, "averageRating" | "ratingCount" | "bookingCount" | "_count" | "user"> & {
  rating?: number
  reviewCount?: number
  _count?: Employee["_count"]
  averageRating?: number
  ratingCount?: number
  bookingCount?: number
  name?: string | null
  nameEn?: string | null
  email?: string | null
  phone?: string | null
  user?: (Employee["user"] & { avatarUrl?: string | null }) | null
  branchIds?: string[]
  serviceIds?: string[]
}

function splitName(full: string | null | undefined): { firstName: string; lastName: string } {
  const parts = (full ?? "").trim().split(/\s+/)
  if (parts.length === 0 || parts[0] === "") return { firstName: "", lastName: "" }
  if (parts.length === 1) return { firstName: parts[0], lastName: "" }
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") }
}

function mapEmployee(raw: RawEmployee): Employee {
  const fullName = raw.nameAr ?? raw.name ?? raw.nameEn ?? ""
  const { firstName, lastName } = splitName(fullName)
  const user: Employee["user"] = raw.user ?? {
    id: raw.userId ?? raw.id,
    firstName,
    lastName,
    email: raw.email ?? "",
    phone: raw.phone ?? null,
  }
  return {
    ...raw,
    user,
    specialty: raw.specialty ?? "",
    specialtyAr: raw.specialtyAr ?? null,
    avatarUrl: raw.user?.avatarUrl ?? raw.avatarUrl ?? null,
    averageRating: raw.averageRating ?? raw.rating ?? undefined,
    ratingCount: raw.ratingCount ?? raw.reviewCount ?? raw._count?.ratings ?? 0,
    bookingCount: raw.bookingCount ?? raw._count?.bookings ?? 0,
    _count: raw._count ?? {
      bookings: raw.bookingCount ?? 0,
      ratings: raw.ratingCount ?? raw.reviewCount ?? 0,
    },
  }
}

export async function fetchEmployee(id: string): Promise<Employee> {
  const res = await api.get<RawEmployee>(`/dashboard/people/employees/${id}`)
  return mapEmployee(res)
}

/* ─── CRUD ─── */

export async function createEmployee(
  payload: CreateEmployeePayload,
): Promise<Employee> {
  return api.post<Employee>("/dashboard/people/employees", payload)
}

export async function onboardEmployee(
  payload: OnboardEmployeePayload,
): Promise<OnboardEmployeeResponse> {
  return api.post<OnboardEmployeeResponse>(`/dashboard/people/employees/onboarding`, payload)
}

export async function updateEmployee(
  id: string,
  payload: UpdateEmployeePayload,
): Promise<Employee> {
  return api.patch<Employee>(`/dashboard/people/employees/${id}`, payload)
}

export async function deleteEmployee(id: string): Promise<void> {
  await api.delete(`/dashboard/people/employees/${id}`)
}

/* ─── Stats ─── */

export interface EmployeeStats {
  total: number
  active: number
  inactive: number
  avgRating: number | null
}

export async function fetchEmployeeStats(): Promise<EmployeeStats> {
  return api.get<EmployeeStats>("/dashboard/people/employees/stats")
}

/* ─── Avatar Upload ─── */

export async function uploadEmployeeAvatar(
  employeeId: string,
  file: File,
): Promise<{ url: string }> {
  const formData = new FormData()
  formData.append("file", file)

  return api.postForm<{ url: string }>(
    `/dashboard/people/employees/${employeeId}/avatar`,
    formData,
  )
}

/* ─── Employee Account ─── */

export type EmployeeAccountRole = 'SUPER_ADMIN' | 'ADMIN' | 'RECEPTIONIST' | 'ACCOUNTANT' | 'EMPLOYEE' | 'CLIENT'

export interface EmployeeAccount {
  id: string
  email: string
  role: EmployeeAccountRole
  isActive: boolean
}

export interface EmployeeAccountStatus {
  hasAccount: boolean
  employeeEmail: string | null
  account: EmployeeAccount | null
}

export async function fetchEmployeeAccount(id: string): Promise<EmployeeAccountStatus> {
  return api.get<EmployeeAccountStatus>(`/dashboard/people/employees/${id}/account`)
}

export async function createEmployeeAccount(
  id: string,
  payload: { role: EmployeeAccountRole; password?: string },
): Promise<EmployeeAccount> {
  return api.post<EmployeeAccount>(`/dashboard/people/employees/${id}/account`, payload)
}

export async function updateEmployeeAccount(
  id: string,
  payload: { role?: EmployeeAccountRole; isActive?: boolean },
): Promise<EmployeeAccount> {
  return api.patch<EmployeeAccount>(`/dashboard/people/employees/${id}/account`, payload)
}

/* ─── Custom Pricing ─── */

export interface SetCustomPricingPayload {
  enabled: boolean
  types: { deliveryType: 'IN_PERSON' | 'ONLINE'; price: number; durationMins: number }[]
}

export async function setEmployeeCustomPricing(
  employeeId: string,
  serviceId: string,
  payload: SetCustomPricingPayload,
): Promise<{ hasCustomPricing: boolean; serviceTypes: ServiceEmployeeServiceType[] }> {
  return api.put(
    `/dashboard/people/employees/${employeeId}/services/${serviceId}/custom-pricing`,
    payload,
  )
}

/* ─── Practitioner Durations ─── */

export interface PractitionerDurationItemPayload {
  id?: string
  label: string
  labelAr: string
  durationMins: number
  price: number  // integer halalas
}

export interface PractitionerDurationsByTypePayload {
  deliveryType: string
  items: PractitionerDurationItemPayload[]
}

export interface SetPractitionerDurationsPayload {
  durations: PractitionerDurationsByTypePayload[]
}

export async function setEmployeeDurations(
  employeeId: string,
  serviceId: string,
  payload: SetPractitionerDurationsPayload,
): Promise<unknown> {
  return api.put(
    `/dashboard/people/employees/${employeeId}/services/${serviceId}/durations`,
    payload,
  )
}

export async function setEmployeeDeliveryTypes(
  employeeId: string,
  serviceId: string,
  disabledDeliveryTypes: string[],
): Promise<{ disabledDeliveryTypes: string[] }> {
  return api.put(
    `/dashboard/people/employees/${employeeId}/services/${serviceId}/delivery-types`,
    { disabledDeliveryTypes },
  )
}

export async function setEmployeePricingMode(
  employeeId: string,
  serviceId: string,
  useCustomPricing: boolean,
): Promise<{ useCustomPricing: boolean }> {
  return api.put(
    `/dashboard/people/employees/${employeeId}/services/${serviceId}/pricing-mode`,
    { useCustomPricing },
  )
}
