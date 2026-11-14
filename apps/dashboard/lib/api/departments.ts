/**
 * Departments API — Sawaa Dashboard
 *
 * Every call goes through the typed helper in `lib/api/openapi.ts`, so a
 * renamed route or a changed payload is a type error here. Response types come
 * from the committed OpenAPI snapshot (`lib/types/department.ts`).
 */

import { openApi } from "@/lib/api/openapi"
import type {
  Department,
  DepartmentListQuery,
  CreateDepartmentPayload,
  UpdateDepartmentPayload,
} from "@/lib/types/department"
import type { PaginatedResponse } from "@/lib/types/common"
import type { components } from "@/lib/types/api.generated"

type DepartmentReadWire = components["schemas"]["DepartmentResponseDto"]

/**
 * The API sends `nameEn: null`; the dashboard has always rendered it as a
 * string, so it is normalised once, here.
 *
 * PATCH re-reads the row after the write, so a concurrent delete is the only
 * way to receive `null`. Before this change the helper dereferenced the body
 * unconditionally, which threw on that path; a null body has therefore always
 * been a failure. Keep it a failure, with a message instead of a TypeError.
 */
function toDepartment(department: DepartmentReadWire | null): Department {
  if (!department) throw new Error("Department not found")
  return { ...department, nameEn: department.nameEn ?? "" }
}

export async function fetchDepartments(
  query: DepartmentListQuery = {},
): Promise<PaginatedResponse<Department>> {
  const response = await openApi.get("/api/v1/dashboard/organization/departments", {
    query: {
      page: query.page,
      limit: query.limit,
      isActive: query.isActive,
      search: query.search,
    },
  })
  return { ...response, items: response.items.map(toDepartment) }
}

export async function fetchDepartment(id: string): Promise<Department> {
  const department = await openApi.get(
    "/api/v1/dashboard/organization/departments/{departmentId}",
    { path: { departmentId: id } },
  )
  return toDepartment(department)
}

export async function createDepartment(
  payload: CreateDepartmentPayload,
): Promise<Department> {
  const department = await openApi.post("/api/v1/dashboard/organization/departments", {
    body: payload,
  })
  return toDepartment(department)
}

export async function updateDepartment(
  id: string,
  payload: UpdateDepartmentPayload,
): Promise<Department> {
  const department = await openApi.patch("/api/v1/dashboard/organization/departments/{departmentId}", {
    path: { departmentId: id },
    body: payload,
  })
  return toDepartment(department)
}

export async function deleteDepartment(id: string): Promise<{ deleted: boolean }> {
  return openApi.delete("/api/v1/dashboard/organization/departments/{departmentId}", {
    path: { departmentId: id },
  })
}
