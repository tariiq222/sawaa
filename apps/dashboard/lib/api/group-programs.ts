/**
 * Group Programs API — Sawaa Dashboard
 * Controller: dashboard/group-programs
 */

import { api } from "@/lib/api"
import type {
  GroupProgramListItem,
  GroupProgramListQuery,
  CreateGroupProgramPayload,
} from "@/lib/types/group-program"

export type { GroupProgramListQuery, CreateGroupProgramPayload }

export async function fetchGroupPrograms(
  query: GroupProgramListQuery = {},
): Promise<GroupProgramListItem[]> {
  return api.get<GroupProgramListItem[]>("/dashboard/group-programs", {
    activeOnly: query.activeOnly,
    departmentId: query.departmentId,
  })
}

export async function createGroupProgram(
  payload: CreateGroupProgramPayload,
): Promise<{ id: string; ref: string }> {
  return api.post<{ id: string; ref: string }>("/dashboard/group-programs", payload)
}
