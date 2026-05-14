import { apiRequest } from '../client'
import { buildQueryString } from '../types/api'
import type { PaginatedResponse } from '../types/api'
import type { GroupListItem, GroupListQuery } from '../types/group'

export async function list(query: GroupListQuery = {}): Promise<PaginatedResponse<GroupListItem>> {
  return apiRequest<PaginatedResponse<GroupListItem>>(
    `/groups${buildQueryString(query as Record<string, unknown>)}`,
  )
}

export async function get(id: string): Promise<GroupListItem> {
  return apiRequest<GroupListItem>(`/groups/${id}`)
}
