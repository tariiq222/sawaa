import { apiRequest } from '../client'
import { buildQueryString } from '../types/api'
import type {
  ClientListItem,
  ClientListQuery,
  ClientListResponse,
  ClientStats,
  CreateWalkInPayload,
  UpdateClientPayload,
} from '../types/client'

export interface SetClientActivePayload {
  isActive: boolean
  reason?: string
}

export interface SetClientActiveResult {
  id: string
  isActive: boolean
}

export async function list(query: ClientListQuery = {}): Promise<ClientListResponse> {
  return apiRequest<ClientListResponse>(
    `/clients${buildQueryString(query as Record<string, unknown>)}`,
  )
}

export async function stats(): Promise<ClientStats> {
  return apiRequest<ClientStats>('/clients/list-stats')
}

export async function get(id: string): Promise<ClientListItem> {
  return apiRequest<ClientListItem>(`/clients/${id}`)
}

export async function update(
  id: string,
  payload: UpdateClientPayload,
): Promise<ClientListItem> {
  return apiRequest<ClientListItem>(`/clients/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function createWalkIn(
  payload: CreateWalkInPayload,
): Promise<ClientListItem> {
  return apiRequest<ClientListItem>('/clients/walk-in', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function setClientActive(
  id: string,
  payload: SetClientActivePayload,
): Promise<SetClientActiveResult> {
  return apiRequest<SetClientActiveResult>(`/clients/${id}/active`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}
