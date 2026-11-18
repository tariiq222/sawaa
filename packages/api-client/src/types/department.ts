import type { components, paths } from './generated/openapi'
import type { PaginatedResponse, PaginationParams } from './api'

type Schemas = components['schemas']
type DepartmentQuery = NonNullable<
  paths['/api/v1/dashboard/organization/departments']['get']['parameters']['query']
>

/**
 * `GET /api/v1/dashboard/organization/departments` row
 * (`DepartmentListItemResponseDto`), projected to the keys this legacy client
 * exposes. The category/count extras on the documented row are intentionally
 * not exported here (unchanged from before).
 */
export type DepartmentListItem = Pick<
  Schemas['DepartmentListItemResponseDto'],
  | 'id'
  | 'nameAr'
  | 'descriptionAr'
  | 'descriptionEn'
  | 'icon'
  | 'sortOrder'
  | 'isActive'
  | 'createdAt'
> & {
  /** Documented as nullable; the old contract required it, so it is kept required. */
  nameEn: string
}

export type DepartmentListQuery = PaginationParams & Pick<DepartmentQuery, 'isActive'>

/**
 * Request body of `POST /api/v1/dashboard/organization/departments`
 * (`CreateDepartmentDto`), projected to the keys this client sends. The extra
 * documented `isVisible` flag is not part of this legacy payload.
 */
export type CreateDepartmentPayload = {
  nameAr: Schemas['CreateDepartmentDto']['nameAr']
  /** Documented as optional; the old contract required it, so it stays required. */
  nameEn: NonNullable<Schemas['CreateDepartmentDto']['nameEn']>
  descriptionAr?: NonNullable<Schemas['CreateDepartmentDto']['descriptionAr']>
  descriptionEn?: NonNullable<Schemas['CreateDepartmentDto']['descriptionEn']>
  icon?: NonNullable<Schemas['CreateDepartmentDto']['icon']>
  sortOrder?: NonNullable<Schemas['CreateDepartmentDto']['sortOrder']>
  isActive?: NonNullable<Schemas['CreateDepartmentDto']['isActive']>
}

/** Request body of `PATCH …/departments/{departmentId}` (`UpdateDepartmentDto`), same projection. */
export type UpdateDepartmentPayload = {
  nameAr?: NonNullable<Schemas['UpdateDepartmentDto']['nameAr']>
  nameEn?: NonNullable<Schemas['UpdateDepartmentDto']['nameEn']>
  /** Documented as nullable; kept non-null per the old contract. */
  descriptionAr?: string
  descriptionEn?: string
  icon?: string
  sortOrder?: NonNullable<Schemas['UpdateDepartmentDto']['sortOrder']>
  isActive?: NonNullable<Schemas['UpdateDepartmentDto']['isActive']>
}

export type DepartmentListResponse = PaginatedResponse<DepartmentListItem>
