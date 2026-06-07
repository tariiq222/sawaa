import { apiRequest } from '../client'
import type {
  ServiceListItem,
  ServiceListQuery,
  ServiceListResponse,
  CreateServicePayload,
  UpdateServicePayload,
  ServiceBookingConfig,
  ServiceDurationOption,
} from '../types/service'

function buildQueryString(query: Record<string, unknown>): string {
  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      params.append(key, String(value))
    }
  })
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export async function listServices(
  query: ServiceListQuery = {},
): Promise<ServiceListResponse> {
  const qs = buildQueryString({
    page: query.page,
    limit: query.perPage,
    categoryId: query.categoryId,
    isActive: query.isActive,
    includeHidden: query.includeHidden,
    branchId: query.branchId,
  })
  return apiRequest<ServiceListResponse>(`/dashboard/services${qs}`)
}

export async function getService(id: string): Promise<ServiceListItem> {
  return apiRequest<ServiceListItem>(`/dashboard/services/${id}`)
}

export async function createService(
  payload: CreateServicePayload,
): Promise<ServiceListItem> {
  return apiRequest<ServiceListItem>('/dashboard/services', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateService(
  id: string,
  payload: UpdateServicePayload,
): Promise<ServiceListItem> {
  return apiRequest<ServiceListItem>(`/dashboard/services/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function deleteService(id: string): Promise<void> {
  return apiRequest<void>(`/dashboard/services/${id}`, {
    method: 'DELETE',
  })
}

// ─── Booking Config ─────────────────────────────────────────────────────────

export async function getServiceBookingConfigs(
  serviceId: string,
): Promise<ServiceBookingConfig[]> {
  return apiRequest<ServiceBookingConfig[]>(
    `/dashboard/services/${serviceId}/booking-configs`,
  )
}

// ─── Duration Options ───────────────────────────────────────────────────────

export async function getServiceDurationOptions(
  serviceId: string,
): Promise<ServiceDurationOption[]> {
  return apiRequest<ServiceDurationOption[]>(
    `/dashboard/services/${serviceId}/duration-options`,
  )
}
