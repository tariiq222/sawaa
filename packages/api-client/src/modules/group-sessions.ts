import { apiRequest } from '../client'
import type {
  GroupSessionDetail,
  GroupSessionListQuery,
  GroupSessionListResponse,
  CreateGroupSessionPayload,
} from '../types/group-session'

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

export async function listGroupSessions(
  query: GroupSessionListQuery = {},
): Promise<GroupSessionListResponse> {
  const qs = buildQueryString({
    page: query.page,
    limit: query.limit,
    status: query.status,
    upcoming: query.upcoming,
  })
  return apiRequest<GroupSessionListResponse>(`/dashboard/group-sessions${qs}`)
}

export async function getGroupSession(id: string): Promise<GroupSessionDetail> {
  return apiRequest<GroupSessionDetail>(`/dashboard/group-sessions/${id}`)
}

export async function createGroupSession(
  payload: CreateGroupSessionPayload,
): Promise<GroupSessionDetail> {
  return apiRequest<GroupSessionDetail>('/dashboard/group-sessions', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function cancelGroupSession(
  id: string,
  payload: { cancelReason?: string } = {},
): Promise<GroupSessionDetail> {
  return apiRequest<GroupSessionDetail>(`/dashboard/group-sessions/${id}/cancel`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}
