/**
 * User & Role Types — Deqah Dashboard
 */

import type { SearchableQuery } from "./common"

/* ─── Entities ─── */

export type UserRole =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "RECEPTIONIST"
  | "ACCOUNTANT"
  | "EMPLOYEE"
  | "CLIENT"

export type TenantUserRole =
  | "ADMIN"
  | "RECEPTIONIST"
  | "ACCOUNTANT"
  | "EMPLOYEE"

export type UserGender = "MALE" | "FEMALE"

export interface User {
  id: string
  email: string
  name: string
  phone: string | null
  gender: UserGender | null
  avatarUrl: string | null
  isActive: boolean
  role: UserRole
  customRoleId: string | null
  createdAt: string
  updatedAt: string
}

export interface Role {
  id: string
  name: string
  slug: string
  description: string | null
  isDefault: boolean
  isSystem: boolean
  createdAt: string
  permissions: Permission[]
}

export interface Permission {
  id: string
  module?: string
  subject?: string
  action: string
}

/* ─── Query ─── */

export interface UserListQuery extends SearchableQuery {
  role?: UserRole
  isActive?: boolean
}

/* ─── DTOs ─── */

export interface CreateUserPayload {
  email: string
  password: string
  name: string
  role: TenantUserRole
  phone?: string
  gender?: UserGender
  customRoleId?: string
}

export interface UpdateUserPayload {
  email?: string
  name?: string
  phone?: string
  gender?: UserGender
  role?: TenantUserRole
  customRoleId?: string | null
}

export interface AssignRolePayload {
  customRoleId: string
}

export interface CreateRolePayload {
  name: string
}

export interface RolePermissionPayload {
  subject: string
  action: string
}
