import { api } from "@/lib/api"
import type {
  Department,
  DepartmentListQuery,
  CreateDepartmentPayload,
  UpdateDepartmentPayload,
} from "@/lib/types/department"
import type { PaginatedResponse } from "@/lib/types/common"

export async function fetchDepartments(
  query: DepartmentListQuery = {},
): Promise<PaginatedResponse<Department>> {
  return api.get("/dashboard/organization/departments", {
    page: query.page,
    limit: query.perPage,
    isActive: query.isActive,
    search: query.search,
  })
}

export async function createDepartment(
  payload: CreateDepartmentPayload,
): Promise<Department> {
  return api.post("/dashboard/organization/departments", payload)
}

export async function updateDepartment(
  id: string,
  payload: UpdateDepartmentPayload,
): Promise<Department> {
  return api.patch(`/dashboard/organization/departments/${id}`, payload)
}

export async function deleteDepartment(id: string): Promise<{ deleted: boolean }> {
  return api.delete(`/dashboard/organization/departments/${id}`)
}
