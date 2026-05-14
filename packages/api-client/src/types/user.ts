import type { PaginatedResponse, PaginationParams } from './api'

export type UserGender = 'male' | 'female'

export interface UserRole {
  id: string
  name: string
  slug: string
}

export interface UserListItem {
  id: string
  email: string
  firstName: string
  lastName: string
  phone: string | null
  gender: UserGender | null
  isActive: boolean
  createdAt: string
  roles: UserRole[]
}

export interface UserListQuery extends PaginationParams {
  isActive?: boolean
  role?: string
}

export type UserListResponse = PaginatedResponse<UserListItem>

export interface CreateUserPayload {
  email: string
  password: string
  firstName: string
  lastName: string
  phone?: string
  gender?: UserGender
  roleSlug: string
}

export interface UpdateUserPayload {
  email?: string
  firstName?: string
  lastName?: string
  phone?: string
  gender?: UserGender
}
