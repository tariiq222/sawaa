/**
 * Services API — Sawaa Dashboard
 */

import { api } from "@/lib/api"
import {
  openApi,
  type OpenApiRequestBody,
  type OpenApiResponse,
} from "@/lib/api/openapi"
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

type CategoriesPath = "/api/v1/dashboard/organization/categories"
type CategoryPath = "/api/v1/dashboard/organization/categories/{categoryId}"
const CategoriesPathValue: CategoriesPath = "/api/v1/dashboard/organization/categories"
const CategoryPathValue: CategoryPath = "/api/v1/dashboard/organization/categories/{categoryId}"
type CategoryWire = OpenApiResponse<CategoryPath, "patch">
type CategoryListItemWire = OpenApiResponse<CategoriesPath, "get">["items"][number]
type CreateCategoryBody = OpenApiRequestBody<CategoriesPath, "post">
type UpdateCategoryBody = OpenApiRequestBody<CategoryPath, "patch">

function toCategory(category: CategoryWire | CategoryListItemWire): ServiceCategory {
  return category
}

export async function fetchCategories(
  query: CategoryListQuery = {},
): Promise<PaginatedResponse<ServiceCategory>> {
  const response = await openApi.get(CategoriesPathValue, {
    query: {
      page: query.page,
      limit: query.limit,
      search: query.search,
      isActive: query.isActive,
      departmentId: query.departmentId,
    },
  })
  return { ...response, items: response.items.map(toCategory) }
}

/** Picker callers need every page; list pages keep fetchCategories pagination. */
export async function fetchAllCategories(): Promise<PaginatedResponse<ServiceCategory>> {
  const first = await fetchCategories({ page: 1, limit: 100 })
  const items = [...first.items]
  for (let page = 2; page <= first.meta.totalPages; page++) items.push(...(await fetchCategories({ page, limit: 100 })).items)
  return { ...first, items }
}

export async function fetchCategory(id: string): Promise<ServiceCategory> {
  return api.get<ServiceCategory>(`/dashboard/organization/categories/${id}`)
}

export async function createCategory(
  payload: CreateCategoryPayload,
): Promise<ServiceCategory> {
  const body = payload satisfies CreateCategoryBody
  const category = await openApi.post(CategoriesPathValue, { body })
  return toCategory(category)
}

export async function updateCategory(
  id: string,
  payload: UpdateCategoryPayload,
): Promise<ServiceCategory> {
  const body = payload satisfies UpdateCategoryBody
  const category = await openApi.patch(
    CategoryPathValue,
    { path: { categoryId: id }, body },
  )
  return toCategory(category)
}

export async function deleteCategory(id: string): Promise<void> {
  await openApi.delete(CategoryPathValue, { path: { categoryId: id } })
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
  const body = { imageUrl: uploaded.storageKey } satisfies UpdateCategoryBody
  const category = await openApi.patch(
    CategoryPathValue,
    { path: { categoryId }, body },
  )
  return toCategory(category)
}

/* ─── Services ─── */

/**
 * Default filter shape for the services list page (page 1 of the dashboard
 * admin view). Shared by the `useServices` hook AND the sidebar route
 * prefetch for `/services` so they warm the same query key — change here,
 * both sides move together.
 */
export const DEFAULT_SERVICES_LIST_QUERY: ServiceListQuery = {
  page: 1,
  limit: 20,
  includeHidden: true,
  sortBy: "createdAt",
  sortOrder: "desc",
}

export async function fetchServices(
  query: ServiceListQuery & { historicalContext?: boolean } = {},
): Promise<PaginatedResponse<Service>> {
  return api.get<PaginatedResponse<Service>>("/dashboard/organization/services", {
    page: query.page,
    limit: query.limit,
    isActive: query.isActive,
    categoryId: query.categoryId,
    branchId: query.branchId,
    departmentId: query.departmentId,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
    search: query.search,
    includeHidden: query.includeHidden,
    historicalContext: query.historicalContext,
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
