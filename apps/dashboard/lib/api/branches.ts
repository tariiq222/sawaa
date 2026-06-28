/**
 * Branches API — Sawaa Dashboard
 */

import { api } from "@/lib/api"
import type { PaginatedResponse } from "@/lib/types/common"
import type {
  Branch,
  BranchEmployeeAssignment,
  BranchListQuery,
} from "@/lib/types/branch"

/* ─── List ─── */

export async function fetchBranches(
  query: BranchListQuery = {},
): Promise<PaginatedResponse<Branch>> {
  return api.get<PaginatedResponse<Branch>>("/dashboard/organization/branches", {
    page: query.page,
    limit: query.limit,
    search: query.search,
    isActive: query.isActive,
  })
}

/* ─── Employees ─── */

export async function assignEmployeeToBranch(
  branchId: string,
  employeeId: string,
): Promise<BranchEmployeeAssignment> {
  return api.post<BranchEmployeeAssignment>(
    `/dashboard/organization/branches/${branchId}/employees`,
    { employeeId },
  )
}

export async function unassignEmployeeFromBranch(
  branchId: string,
  employeeId: string,
): Promise<{ id: string }> {
  return api.delete<{ id: string }>(
    `/dashboard/organization/branches/${branchId}/employees/${employeeId}`,
  )
}

