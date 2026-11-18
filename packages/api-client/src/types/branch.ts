import type { components, paths } from './generated/openapi'
import type { PaginatedResponse, PaginationParams } from './api'

type Schemas = components['schemas']
type BranchQuery = NonNullable<
  paths['/api/v1/dashboard/organization/branches']['get']['parameters']['query']
>

/**
 * `GET /api/v1/dashboard/organization/branches` row (`BranchResponseDto`),
 * projected to the keys this client exposes. `address` and `email` are local
 * projections the snapshot does not express:
 *  - `address` joins the documented `addressAr`/`addressEn` pair;
 *  - `email` is a legacy key the API has never returned.
 */
export type BranchListItem = Pick<
  Schemas['BranchResponseDto'],
  'id' | 'nameAr' | 'phone' | 'isMain' | 'isActive' | 'createdAt'
> & {
  /** Documented as nullable; the old contract required it, so it is kept required. */
  nameEn: string
  /** Documented as required string; the old contract allowed null, so it is kept nullable. */
  timezone: string | null
  /** Projection of `addressAr`/`addressEn`; the snapshot has no single field. */
  address: string | null
  /** Legacy UI key; not present on `BranchResponseDto`. */
  email: string | null
}

/** Query of the list operation, plus the shared paging controls. */
export type BranchListQuery = PaginationParams & Pick<BranchQuery, 'isActive'>

/**
 * Request body of `POST /api/v1/dashboard/organization/branches`. Kept local:
 * the documented `CreateBranchDto` splits address into `addressAr`/`addressEn`
 * (+ city/country/lat/lng) and carries no `email`, which is a different
 * contract from this legacy payload.
 */
export interface CreateBranchPayload {
  nameAr: string
  nameEn: string
  address?: string
  phone?: string
  email?: string
  isMain?: boolean
  isActive?: boolean
  timezone?: string
}

/** Same deviation as `CreateBranchPayload`; `UpdateBranchDto` uses addressAr/addressEn. */
export interface UpdateBranchPayload {
  nameAr?: string
  nameEn?: string
  address?: string
  phone?: string
  email?: string
  isMain?: boolean
  isActive?: boolean
  timezone?: string
}

export type BranchListResponse = PaginatedResponse<BranchListItem>
