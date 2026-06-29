/**
 * Services API — Sawaa Dashboard
 */

import { api } from "@/lib/api"
import type { PaginatedResponse } from "@/lib/types/common"
import type {
  Service,
  ServiceCategory,
  ServiceBookingType,
  ServiceDurationOption,
  ServiceListQuery,
  ServiceEmployee,
  CategoryListQuery,
} from "@/lib/types/service"
import type {
  CreateCategoryPayload,
  UpdateCategoryPayload,
  CreateServicePayload,
  UpdateServicePayload,
  SetDurationOptionsPayload,
  SetServiceBookingTypesPayload,
} from "@/lib/types/service-payloads"

/* ─── Categories ─── */

export async function fetchCategories(
  query: CategoryListQuery = {},
): Promise<PaginatedResponse<ServiceCategory>> {
  return api.get<PaginatedResponse<ServiceCategory>>("/dashboard/organization/categories", {
    page: query.page,
    limit: query.limit,
    search: query.search,
    isActive: query.isActive,
    departmentId: query.departmentId,
  })
}

export async function createCategory(
  payload: CreateCategoryPayload,
): Promise<ServiceCategory> {
  return api.post<ServiceCategory>(
    "/dashboard/organization/categories",
    payload,
  )
}

export async function updateCategory(
  id: string,
  payload: UpdateCategoryPayload,
): Promise<ServiceCategory> {
  return api.patch<ServiceCategory>(
    `/dashboard/organization/categories/${id}`,
    payload,
  )
}

export async function deleteCategory(id: string): Promise<void> {
  await api.delete(`/dashboard/organization/categories/${id}`)
}

/* ─── Category Image ─── */

export async function uploadCategoryImage(categoryId: string, file: File): Promise<ServiceCategory> {
  const formData = new FormData()
  formData.append("file", file)

  // Step 1: upload file to media storage (via api client for refresh handling)
  const uploaded = await api.postForm<{ id: string; storageKey: string }>("/dashboard/media/upload", formData)

  // Step 2: persist the bare object KEY (not a presigned URL). The backend
  // mints a short-lived presigned URL at read time. Storing the presigned URL
  // here would 403 once its signature expired (~15 min) — see audit D.1.
  return api.patch<ServiceCategory>(`/dashboard/organization/categories/${categoryId}`, { imageUrl: uploaded.storageKey })
}

/* ─── Services ─── */

export async function fetchServices(
  query: ServiceListQuery = {},
): Promise<PaginatedResponse<Service>> {
  return api.get<PaginatedResponse<Service>>("/dashboard/organization/services", {
    page: query.page,
    limit: query.limit,
    isActive: query.isActive,
    categoryId: query.categoryId,
    search: query.search,
    includeHidden: query.includeHidden,
  })
}

export async function fetchService(id: string): Promise<Service> {
  return api.get<Service>(`/dashboard/organization/services/${id}`)
}

export async function createService(
  payload: CreateServicePayload,
): Promise<Service> {
  return api.post<Service>("/dashboard/organization/services", payload)
}

export async function updateService(
  id: string,
  payload: UpdateServicePayload,
): Promise<Service> {
  return api.patch<Service>(`/dashboard/organization/services/${id}`, payload)
}

export async function deleteService(id: string): Promise<void> {
  await api.delete(`/dashboard/organization/services/${id}`)
}

/* ─── Duration Options ─── */

export async function fetchDurationOptions(
  serviceId: string,
): Promise<ServiceDurationOption[]> {
  return api.get<ServiceDurationOption[]>(
    `/dashboard/organization/services/${serviceId}/duration-options`,
  )
}

export async function setDurationOptions(
  serviceId: string,
  payload: SetDurationOptionsPayload,
): Promise<ServiceDurationOption[]> {
  return api.put<ServiceDurationOption[]>(
    `/dashboard/organization/services/${serviceId}/duration-options`,
    payload,
  )
}

/* ─── Booking Types ─── */

export async function fetchServiceBookingTypes(
  serviceId: string,
): Promise<ServiceBookingType[]> {
  return api.get<ServiceBookingType[]>(
    `/dashboard/organization/services/${serviceId}/booking-types`,
  )
}

export async function setServiceBookingTypes(
  serviceId: string,
  payload: SetServiceBookingTypesPayload,
): Promise<ServiceBookingType[]> {
  return api.put<ServiceBookingType[]>(
    `/dashboard/organization/services/${serviceId}/booking-types`,
    payload,
  )
}


/* ─── Service Avatar ─── */

export async function uploadServiceImage(serviceId: string, file: File): Promise<Service> {
  const formData = new FormData()
  formData.append("file", file)

  // Step 1: upload file to media storage (via api client for refresh handling)
  const uploaded = await api.postForm<{ id: string; storageKey: string }>("/dashboard/media/upload", formData)

  // Step 2: persist the bare object KEY (not a presigned URL). The backend
  // mints a short-lived presigned URL at read time. Storing the presigned URL
  // here would 403 once its signature expired (~15 min) — see audit D.1.
  return api.patch<Service>(`/dashboard/organization/services/${serviceId}`, { imageUrl: uploaded.storageKey })
}

/* ─── Service Employees ─── */

export async function fetchServiceEmployees(
  serviceId: string,
): Promise<ServiceEmployee[]> {
  return api.get<ServiceEmployee[]>(`/dashboard/organization/services/${serviceId}/employees`)
}

/* ─── Service List Stats ─── */

export interface ServiceListStats {
  total: number
  active: number
  inactive: number
}

export async function fetchServicesListStats(): Promise<ServiceListStats> {
  const [all, active] = await Promise.all([
    api.get<{ meta: { total: number } }>("/dashboard/organization/services", { limit: 1 }),
    api.get<{ meta: { total: number } }>("/dashboard/organization/services", { limit: 1, isActive: true }),
  ])
  const total = all.meta?.total ?? 0
  const activeCount = active.meta?.total ?? 0
  return { total, active: activeCount, inactive: total - activeCount }
}

