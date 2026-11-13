/**
 * Employees API — Sawaa Dashboard
 */

export * from "./employees-schedule"

import { api } from "@/lib/api"
import { type OpenApiResponse } from "@/lib/api/openapi"
import type { PaginatedResponse } from "@/lib/types/common"
import type {
  Employee,
  EmployeeDetail,
  EmployeeStats,
  EmployeeListQuery,
  EmployeeWrite,
  CreateEmployeePayload,
  UpdateEmployeePayload,
  OnboardEmployeePayload,
  OnboardEmployeeResponse,
} from "@/lib/types/employee"
import type { ServiceEmployeeServiceType } from "@/lib/types/service"

type EmployeesPath = "/api/v1/dashboard/people/employees"
type EmployeePath = "/api/v1/dashboard/people/employees/{id}"

/** Wire responses, taken from the committed OpenAPI snapshot. */
type EmployeesListWire = OpenApiResponse<EmployeesPath, "get">
type EmployeeDetailWire = OpenApiResponse<EmployeePath, "get">

/* ─── Queries ─── */

export async function fetchEmployees(
  query: EmployeeListQuery & { historicalContext?: boolean } = {},
): Promise<PaginatedResponse<Employee>> {
  const response = await api.get<EmployeesListWire>("/dashboard/people/employees", {
    historicalContext: query.historicalContext,
    page: query.page,
    limit: query.limit,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
    search: query.search,
    minRating: query.minRating,
    isActive: query.isActive,
  })
  return { items: response.items.map(mapEmployee), meta: response.meta }
}

/**
 * Wire row for GET list/detail, taken from the OpenAPI snapshot. The old
 * hand-written fallbacks (`rating`, `reviewCount`, `_count`, a `{ data }`
 * envelope, a nested `user`) had no producer: `ListEmployeesHandler` maps rows
 * through `mapEmployeeRow`, which emits `averageRating`/`ratingCount`/
 * `bookingCount` directly and returns `{ items, meta }` via `toListResponse`.
 * They are removed rather than carried forward.
 */
type RawEmployee = EmployeesListWire["items"][number]

function splitName(full: string | null | undefined): { firstName: string; lastName: string } {
  const parts = (full ?? "").trim().split(/\s+/)
  if (parts.length === 0 || parts[0] === "") return { firstName: "", lastName: "" }
  if (parts.length === 1) return { firstName: parts[0], lastName: "" }
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") }
}

/**
 * Dashboard projection of a wire employee row. The API sends one display name
 * and no linked user; the dashboard UI wants `user.firstName`/`lastName`, so
 * the name is split here and `specialty` is normalised to "" (see the
 * deviation list in `lib/types/employee.ts`).
 */
function mapEmployee<Row extends RawEmployee>(raw: Row): Omit<Row, keyof Employee> & Employee {
  const fullName = raw.nameAr ?? raw.name ?? raw.nameEn ?? ""
  const { firstName, lastName } = splitName(fullName)
  const user: Employee["user"] = {
    id: raw.userId ?? raw.id,
    firstName,
    lastName,
    email: raw.email ?? "",
    phone: raw.phone,
  }
  return {
    ...raw,
    user,
    specialty: raw.specialty ?? "",
  }
}

export async function fetchEmployee(id: string): Promise<EmployeeDetail> {
  const employee = await api.get<EmployeeDetailWire>(`/dashboard/people/employees/${id}`)
  return mapEmployee(employee)
}

/* ─── CRUD ─── */

export async function createEmployee(
  payload: CreateEmployeePayload,
): Promise<EmployeeWrite> {
  return api.post<EmployeeWrite>("/dashboard/people/employees", payload)
}

export async function onboardEmployee(
  payload: OnboardEmployeePayload,
): Promise<OnboardEmployeeResponse> {
  return api.post<OnboardEmployeeResponse>(`/dashboard/people/employees/onboarding`, payload)
}

export async function updateEmployee(
  id: string,
  payload: UpdateEmployeePayload,
): Promise<EmployeeWrite> {
  return api.patch<EmployeeWrite>(`/dashboard/people/employees/${id}`, payload)
}

export async function deleteEmployee(id: string): Promise<void> {
  await api.delete(`/dashboard/people/employees/${id}`)
}

/* ─── Stats ─── */

export type { EmployeeStats } from "@/lib/types/employee"

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

export async function uploadEmployeePublicImage(employeeId: string, file: File): Promise<{ url: string }> {
  const formData = new FormData()
  formData.append("file", file)
  return api.postForm<{ url: string }>(`/dashboard/people/employees/${employeeId}/public-image`, formData)
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
