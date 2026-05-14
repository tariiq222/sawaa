import { apiRequest } from '../client'
import { buildQueryString } from '../types/api'
import type { PaginatedResponse } from '../types/api'
import type {
  IntakeFormListItem,
  IntakeFormDetail,
  IntakeFormListQuery,
  CreateIntakeFormPayload,
  UpdateIntakeFormPayload,
} from '../types/intake-form'

export async function list(query: IntakeFormListQuery = {}): Promise<PaginatedResponse<IntakeFormListItem>> {
  return apiRequest<PaginatedResponse<IntakeFormListItem>>(
    `/intake-forms${buildQueryString(query as Record<string, unknown>)}`,
  )
}

export async function get(id: string): Promise<IntakeFormDetail> {
  return apiRequest<IntakeFormDetail>(`/intake-forms/${id}`)
}

export async function create(payload: CreateIntakeFormPayload): Promise<IntakeFormDetail> {
  return apiRequest<IntakeFormDetail>('/intake-forms', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function update(id: string, payload: UpdateIntakeFormPayload): Promise<IntakeFormDetail> {
  return apiRequest<IntakeFormDetail>(`/intake-forms/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function remove(id: string): Promise<{ deleted: boolean }> {
  return apiRequest<{ deleted: boolean }>(`/intake-forms/${id}`, { method: 'DELETE' })
}
