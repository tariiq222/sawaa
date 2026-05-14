import { apiRequest } from '../client'
import { buildQueryString } from '../types/api'
import type { PaginatedResponse } from '../types/api'
import type {
  NotificationListItem,
  NotificationListQuery,
  UnreadCountResponse,
} from '../types/notification'

export async function list(query: NotificationListQuery = {}): Promise<PaginatedResponse<NotificationListItem>> {
  return apiRequest<PaginatedResponse<NotificationListItem>>(
    `/notifications${buildQueryString(query as Record<string, unknown>)}`,
  )
}

export async function unreadCount(): Promise<UnreadCountResponse> {
  return apiRequest<UnreadCountResponse>('/notifications/unread-count')
}

export async function markRead(id: string): Promise<void> {
  return apiRequest<void>(`/notifications/${id}/read`, { method: 'PATCH' })
}

export async function markAllRead(): Promise<void> {
  return apiRequest<void>('/notifications/read-all', { method: 'PATCH' })
}
