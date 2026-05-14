import { apiRequest } from '../client'
import { buildQueryString } from '../types/api'
import type {
  BranchListItem,
  BranchListQuery,
  BranchListResponse,
  CreateBranchPayload,
  UpdateBranchPayload,
} from '../types/branch'

export async function list(query: BranchListQuery = {}): Promise<BranchListResponse> {
  return apiRequest<BranchListResponse>(
    `/branches${buildQueryString(query as Record<string, unknown>)}`,
  )
}

export async function get(id: string): Promise<BranchListItem> {
  return apiRequest<BranchListItem>(`/branches/${id}`)
}

export async function create(payload: CreateBranchPayload): Promise<BranchListItem> {
  return apiRequest<BranchListItem>('/branches', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function update(
  id: string,
  payload: UpdateBranchPayload,
): Promise<BranchListItem> {
  return apiRequest<BranchListItem>(`/branches/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function remove(id: string): Promise<void> {
  return apiRequest<void>(`/branches/${id}`, { method: 'DELETE' })
}
