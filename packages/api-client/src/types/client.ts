import type { components, paths } from './generated/openapi'
import type { PaginatedResponse, PaginationParams } from './api'

type Schemas = components['schemas']
type ClientListQueryDoc = NonNullable<
  paths['/api/v1/dashboard/people/clients']['get']['parameters']['query']
>

/**
 * Local list row. NOT derived: `GET /dashboard/people/clients` returns
 * `PaginatedClientsDto` whose items are large `ClientResponseDto` /
 * `EmployeeScopedClientResponseDto` entities (name/middleName/accountType/…)
 * with no `isWalkIn`/`totalBookings` counters. This client exposes a narrower
 * legacy projection, so it stays hand-written.
 */
export interface ClientListItem {
  id: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  dateOfBirth: string | null
  gender: 'male' | 'female' | null
  isActive: boolean
  isWalkIn: boolean
  totalBookings: number
  createdAt: string
}

/** NOT derived: no documented clients-stats operation. Kept hand-written. */
export interface ClientStats {
  total: number
  active: number
  walkIn: number
  newThisWeek: number
}

/**
 * Query of `GET /api/v1/dashboard/people/clients`, projected to the paging
 * controls plus `isActive` (the documented `gender`/`source`/sort filters are
 * not part of this legacy query).
 */
export type ClientListQuery = PaginationParams & Pick<ClientListQueryDoc, 'isActive'>

/**
 * NOT derived: `POST /dashboard/people/clients` documents `CreateClientDto`
 * (requires `phone`, adds account/medical fields). This legacy walk-in payload
 * omits `phone` and no module in this package calls that route.
 */
export interface CreateWalkInPayload {
  firstName: string
  lastName: string
  phone?: string
  gender?: 'male' | 'female'
  dateOfBirth?: string
}

/**
 * Request body of `PATCH /dashboard/people/clients/{id}` (`UpdateClientDto`),
 * projected to the keys this client sends.
 */
export type UpdateClientPayload = {
  firstName?: NonNullable<Schemas['UpdateClientDto']['firstName']>
  lastName?: NonNullable<Schemas['UpdateClientDto']['lastName']>
  /** Documented as nullable; kept non-null per the old contract. */
  phone?: string
  email?: string
  /** Documented as `MALE|FEMALE|male|female|null`; kept to the legacy lower-case enum. */
  gender?: 'male' | 'female'
  /** Documented as nullable; kept non-null per the old contract. */
  dateOfBirth?: string
  isActive?: NonNullable<Schemas['UpdateClientDto']['isActive']>
}

export type ClientListResponse = PaginatedResponse<ClientListItem>
