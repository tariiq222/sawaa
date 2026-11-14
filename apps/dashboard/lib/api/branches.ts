/**
 * Branches API — Sawaa Dashboard
 *
 * Every call goes through the typed helper in `lib/api/openapi.ts`, so a
 * renamed route or a changed payload is a type error here. Response types come
 * from the committed OpenAPI snapshot (`lib/types/branch.ts`).
 */

import { openApi } from "@/lib/api/openapi"
import type { PaginatedResponse } from "@/lib/types/common"
import type {
  Branch,
  BranchEmployeeAssignment,
  BranchListQuery,
} from "@/lib/types/branch"
import type { components } from "@/lib/types/api.generated"

type BranchWire = components["schemas"]["BranchResponseDto"]

/**
 * The wire type says `string | null`, but the previous mapper also rejected a
 * wrong runtime type with a thrown error instead of passing it through. Keep
 * that exactly: a malformed field must still fail loudly.
 */
function nullableString(value: unknown): string | null {
  if (value === null || typeof value === "string") return value
  throw new Error("Invalid branch string field")
}

/**
 * Map the wire row onto the dashboard `Branch`.
 *
 * Two rules, both inherited from the hand-written mapper this replaces:
 *  - `nameEn` arrives nullable and is normalised to `""` once;
 *  - only these keys are returned. The wire row also carries `city`, `country`,
 *    `latitude` and `longitude`, which no branch surface reads; spreading the
 *    row would silently start adding them to every consumer's object.
 */
function toBranch(branch: BranchWire): Branch {
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
  const response = await openApi.get("/api/v1/dashboard/organization/branches", {
    query: {
      page: query.page,
      limit: query.limit,
      search: query.search,
      isActive: query.isActive,
    },
  })

  return { ...response, items: response.items.map(toBranch) }
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
