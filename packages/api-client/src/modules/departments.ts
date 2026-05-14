import { apiRequest } from '../client'
import { buildQueryString } from '../types/api'
import type {
  DepartmentListItem,
  DepartmentListQuery,
  DepartmentListResponse,
  CreateDepartmentPayload,
  UpdateDepartmentPayload,
} from '../types/department'

export async function list(
  query: DepartmentListQuery = {},
): Promise<DepartmentListResponse> {
  return apiRequest<DepartmentListResponse>(
    `/departments${buildQueryString(query as Record<string, unknown>)}`,
  )
}

export async function get(id: string): Promise<DepartmentListItem> {
  return apiRequest<DepartmentListItem>(`/departments/${id}`)
}

export async function create(
  payload: CreateDepartmentPayload,
): Promise<DepartmentListItem> {
  return apiRequest<DepartmentListItem>('/departments', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function update(
  id: string,
  payload: UpdateDepartmentPayload,
): Promise<DepartmentListItem> {
  return apiRequest<DepartmentListItem>(`/departments/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function remove(id: string): Promise<{ deleted: boolean }> {
  return apiRequest<{ deleted: boolean }>(`/departments/${id}`, {
    method: 'DELETE',
  })
}
