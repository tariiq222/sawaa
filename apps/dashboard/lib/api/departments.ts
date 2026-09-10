import {
  openApi,
  type OpenApiRequestBody,
  type OpenApiResponse,
} from "@/lib/api/openapi"
import type {
  Department,
  DepartmentListQuery,
  CreateDepartmentPayload,
  UpdateDepartmentPayload,
} from "@/lib/types/department"
import type { PaginatedResponse } from "@/lib/types/common"

type DepartmentsPath = "/api/v1/dashboard/organization/departments"
type DepartmentPath = "/api/v1/dashboard/organization/departments/{departmentId}"
type DepartmentWire = OpenApiResponse<DepartmentPath, "patch">
type DepartmentListItemWire = OpenApiResponse<DepartmentsPath, "get">["items"][number]
type CreateDepartmentBody = OpenApiRequestBody<DepartmentsPath, "post">
type UpdateDepartmentBody = OpenApiRequestBody<DepartmentPath, "patch">

function toDepartment(department: DepartmentWire | DepartmentListItemWire): Department {
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

export async function createDepartment(
  payload: CreateDepartmentPayload,
): Promise<Department> {
  const body = payload satisfies CreateDepartmentBody
  const department = await openApi.post("/api/v1/dashboard/organization/departments", { body })
  return toDepartment(department)
}

export async function updateDepartment(
  id: string,
  payload: UpdateDepartmentPayload,
): Promise<Department> {
  const body = payload satisfies UpdateDepartmentBody
  const department = await openApi.patch(
    "/api/v1/dashboard/organization/departments/{departmentId}",
    { path: { departmentId: id }, body },
  )
  return toDepartment(department)
}

export async function deleteDepartment(id: string): Promise<{ deleted: boolean }> {
  return openApi.delete("/api/v1/dashboard/organization/departments/{departmentId}", {
    path: { departmentId: id },
  })
}
