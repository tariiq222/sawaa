/**
 * Users & Roles API — Deqah Dashboard
 */

import { api } from "@/lib/api"
import type { PaginatedResponse } from "@/lib/types/common"
import type {
  User,
  Role,
  Permission,
  UserListQuery,
  CreateUserPayload,
  UpdateUserPayload,
  AssignRolePayload,
  CreateRolePayload,
  RolePermissionPayload,
} from "@/lib/types/user"

/* ─── Users ─── */

export async function fetchUsers(
  query: UserListQuery = {},
): Promise<PaginatedResponse<User>> {
  return api.get<PaginatedResponse<User>>("/dashboard/identity/users", {
    page: query.page,
    limit: query.perPage,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
    search: query.search,
    role: query.role,
    isActive: query.isActive,
  })
}

export async function fetchUser(id: string): Promise<User> {
  return api.get<User>(`/dashboard/identity/users/${id}`)
}

export async function createUser(payload: CreateUserPayload): Promise<User> {
  return api.post<User>("/dashboard/identity/users", payload)
}

export async function updateUser(
  id: string,
  payload: UpdateUserPayload,
): Promise<User> {
  return api.patch<User>(`/dashboard/identity/users/${id}`, payload)
}

export async function deleteUser(id: string): Promise<void> {
  await api.delete(`/dashboard/identity/users/${id}`)
}

export async function activateUser(id: string): Promise<void> {
  await api.patch(`/dashboard/identity/users/${id}/activate`)
}

export async function deactivateUser(id: string): Promise<void> {
  await api.patch(`/dashboard/identity/users/${id}/deactivate`)
}

export async function assignRole(
  userId: string,
  payload: AssignRolePayload,
): Promise<void> {
  await api.post(`/dashboard/identity/users/${userId}/roles`, payload)
}

export async function removeRole(
  userId: string,
  roleId: string,
): Promise<void> {
  await api.delete(`/dashboard/identity/users/${userId}/roles/${roleId}`)
}

/* ─── Roles ─── */

export async function fetchRoles(): Promise<Role[]> {
  return api.get<Role[]>("/dashboard/identity/roles")
}

export async function createRole(payload: CreateRolePayload): Promise<Role> {
  return api.post<Role>("/dashboard/identity/roles", payload)
}

export async function deleteRole(id: string): Promise<void> {
  await api.delete(`/dashboard/identity/roles/${id}`)
}

export async function setRolePermissions(
  roleId: string,
  permissions: RolePermissionPayload[],
): Promise<void> {
  await api.post(`/dashboard/identity/roles/${roleId}/permissions`, { permissions })
}

/* ─── Permissions ─── */

export async function fetchPermissions(): Promise<Permission[]> {
  return api.get<Permission[]>("/dashboard/identity/permissions")
}
