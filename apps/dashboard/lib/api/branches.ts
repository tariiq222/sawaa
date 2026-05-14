/**
 * Branches API — Deqah Dashboard
 */

import { api } from "@/lib/api"
import type { PaginatedResponse } from "@/lib/types/common"
import type {
  Branch,
  BranchEmployeeAssignment,
  BranchListQuery,
  CreateBranchPayload,
  UpdateBranchPayload,
} from "@/lib/types/branch"

/* ─── List ─── */

export async function fetchBranches(
  query: BranchListQuery = {},
): Promise<PaginatedResponse<Branch>> {
  return api.get<PaginatedResponse<Branch>>("/dashboard/organization/branches", {
    page: query.page,
    limit: query.perPage,
    search: query.search,
    isActive: query.isActive,
  })
}

/* ─── Detail ─── */

export async function fetchBranch(id: string): Promise<Branch> {
  return api.get<Branch>(`/dashboard/organization/branches/${id}`)
}

/* ─── Create ─── */

export async function createBranch(
  payload: CreateBranchPayload,
): Promise<Branch> {
  return api.post<Branch>("/dashboard/organization/branches", payload)
}

/* ─── Update ─── */

export async function updateBranch(
  id: string,
  payload: UpdateBranchPayload,
): Promise<Branch> {
  return api.patch<Branch>(`/dashboard/organization/branches/${id}`, payload)
}

/* ─── Delete ─── */

export async function deleteBranch(id: string): Promise<{ id: string }> {
  return api.delete<{ id: string }>(`/dashboard/organization/branches/${id}`)
}

/* ─── Employees ─── */

export async function fetchBranchEmployees(
  branchId: string,
): Promise<BranchEmployeeAssignment[]> {
  return api.get<BranchEmployeeAssignment[]>(
    `/dashboard/organization/branches/${branchId}/employees`,
  )
}

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

