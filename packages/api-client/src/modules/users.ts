import { apiRequest } from '../client'
import { buildQueryString } from '../types/api'
import type {
  UserListItem,
  UserListQuery,
  UserListResponse,
  CreateUserPayload,
  UpdateUserPayload,
} from '../types/user'

export async function list(query: UserListQuery = {}): Promise<UserListResponse> {
  return apiRequest<UserListResponse>(
    `/users${buildQueryString(query as Record<string, unknown>)}`,
  )
}

export async function get(id: string): Promise<UserListItem> {
  return apiRequest<UserListItem>(`/users/${id}`)
}

export async function create(payload: CreateUserPayload): Promise<UserListItem> {
  return apiRequest<UserListItem>('/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function update(id: string, payload: UpdateUserPayload): Promise<UserListItem> {
  return apiRequest<UserListItem>(`/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function activate(id: string): Promise<UserListItem> {
  return apiRequest<UserListItem>(`/users/${id}/activate`, { method: 'PATCH' })
}

export async function deactivate(id: string): Promise<UserListItem> {
  return apiRequest<UserListItem>(`/users/${id}/deactivate`, { method: 'PATCH' })
}

export async function remove(id: string): Promise<void> {
  return apiRequest<void>(`/users/${id}`, { method: 'DELETE' })
}
