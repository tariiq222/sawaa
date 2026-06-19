/**
 * Group Sessions API — Sawaa Dashboard
 * Controller: dashboard/group-sessions
 */

import { api } from "@/lib/api"
import type { PaginatedResponse } from "@/lib/types/common"
import type {
  GroupSessionListItem,
  GroupSessionDetail,
  GroupSessionListQuery,
  CreateGroupSessionPayload,
} from "@/lib/types/group-session"

export type { GroupSessionListQuery, CreateGroupSessionPayload }

export async function fetchGroupSessions(
  query: GroupSessionListQuery = {},
): Promise<PaginatedResponse<GroupSessionListItem>> {
  return api.get<PaginatedResponse<GroupSessionListItem>>("/dashboard/group-sessions", {
    page: query.page,
    limit: query.limit,
    status: query.status,
    upcoming: query.upcoming,
  })
}

export async function fetchGroupSession(id: string): Promise<GroupSessionDetail> {
  return api.get<GroupSessionDetail>(`/dashboard/group-sessions/${id}`)
}

export async function createGroupSession(
  payload: CreateGroupSessionPayload,
): Promise<GroupSessionDetail> {
  return api.post<GroupSessionDetail>("/dashboard/group-sessions", payload)
}

export async function cancelGroupSession(
  id: string,
  payload: { cancelReason?: string } = {},
): Promise<GroupSessionDetail> {
  return api.patch<GroupSessionDetail>(`/dashboard/group-sessions/${id}/cancel`, payload)
}
