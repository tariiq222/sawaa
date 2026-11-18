import type { components } from './generated/openapi'
import type { PaginatedResponse, PaginationParams } from './api'

type Schemas = components['schemas']

/**
 * Gender vocabulary used when creating staff users. The snapshot's
 * `ClientGender` documents both cases; staff writes use the lower-case form.
 */
export type UserGender = Extract<Schemas['ClientGender'], 'male' | 'female'>

/**
 * Local role summary. NOT derived: the snapshot's `UserRole` is a string enum
 * (`SUPER_ADMIN | ADMIN | …`), while this legacy shape is a `{id,name,slug}`
 * object that no operation in this package returns. Kept hand-written so the
 * exported name keeps its historical shape.
 */
export interface UserRole {
  id: string
  name: string
  slug: string
}

/**
 * Local list row. NOT derived: `packages/api-client` calls no
 * `/dashboard/identity/users` operation, and the dashboard's identity API
 * returns `DashboardUserResponseDto` (no `roles` array). Kept hand-written.
 */
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

/**
 * Local query. NOT derived: the documented users-list operation has no `role`
 * filter (only `search`/`isActive`/paging), and this client does not call it.
 */
export interface UserListQuery extends PaginationParams {
  isActive?: boolean
  role?: string
}

export type UserListResponse = PaginatedResponse<UserListItem>

/**
 * Local write payload. NOT derived: `CreateUserDto` takes a single `name`
 * plus a `role` enum / `customRoleId`, which is a different contract from this
 * legacy `firstName`/`lastName`/`roleSlug` payload. No endpoint in this
 * package consumes it.
 */
export interface CreateUserPayload {
  email: string
  password: string
  firstName: string
  lastName: string
  phone?: string
  gender?: UserGender
  roleSlug: string
}

/**
 * Local write payload. NOT derived: `UpdateUserDto` uses `name` rather than
 * `firstName`/`lastName`. No endpoint in this package consumes it.
 */
export interface UpdateUserPayload {
  email?: string
  firstName?: string
  lastName?: string
  phone?: string
  gender?: UserGender
}
