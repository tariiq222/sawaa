/**
 * Branches API — Sawaa Dashboard
 */

import { openApi } from "@/lib/api/openapi"
import type { OpenApiResponse } from "@/lib/api/openapi"
import type { PaginatedResponse } from "@/lib/types/common"
import type {
  Branch,
  BranchEmployeeAssignment,
  BranchListQuery,
} from "@/lib/types/branch"

type BranchesPath = "/api/v1/dashboard/organization/branches"
type BranchesResponse = OpenApiResponse<BranchesPath, "get">
type ApiBranch = BranchesResponse["items"][number]

function nullableString(value: unknown): string | null {
  if (value === null || typeof value === "string") return value
  throw new Error("Invalid branch string field")
}

function toBranch(branch: ApiBranch): Branch {
  return {
    id: branch.id,
    nameAr: branch.nameAr,
    nameEn: nullableString(branch.nameEn) ?? "",
    addressAr: nullableString(branch.addressAr),
    addressEn: nullableString(branch.addressEn),
    phone: nullableString(branch.phone),
    isMain: branch.isMain,
    isActive: branch.isActive,
    timezone: branch.timezone,
    createdAt: branch.createdAt,
    updatedAt: branch.updatedAt,
  }
}

/* ─── List ─── */

export async function fetchBranches(
  query: BranchListQuery = {},
): Promise<PaginatedResponse<Branch>> {
  const response = await openApi.get(
    "/api/v1/dashboard/organization/branches",
    {
      query: {
        page: query.page,
        limit: query.limit,
        search: query.search,
        isActive: query.isActive,
      },
    },
  )

  return {
    ...response,
    items: response.items.map(toBranch),
  }
}

/* ─── Employees ─── */

export async function assignEmployeeToBranch(
  branchId: string,
  employeeId: string,
): Promise<BranchEmployeeAssignment> {
  return openApi.post(
    "/api/v1/dashboard/organization/branches/{branchId}/employees",
    {
      path: { branchId },
      body: { employeeId },
    },
  )
}

export async function unassignEmployeeFromBranch(
  branchId: string,
  employeeId: string,
): Promise<{ id: string }> {
  return openApi.delete(
    "/api/v1/dashboard/organization/branches/{branchId}/employees/{employeeId}",
    {
      path: { branchId, employeeId },
    },
  )
}
