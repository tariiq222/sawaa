import type { components } from './generated/openapi'
import type { PaginatedResponse, PaginationParams } from './api'

type Schemas = components['schemas']
type RatingRow = Schemas['OrganizationRatingResponseDto']

/**
 * Row of `GET /api/v1/dashboard/organization/ratings`
 * (`OrganizationRatingResponseDto`), projected to the legacy shape. The
 * documented row carries `client`/`employee` name projections and `isPublic`;
 * this legacy type exposes only the client's first/last name.
 */
export type EmployeeRating = Pick<
  RatingRow,
  'id' | 'bookingId' | 'employeeId' | 'comment' | 'createdAt'
> & {
  /** Documented as required; the old contract allowed null, so it is kept nullable. */
  clientId: string | null
  /** Documented as `score`; legacy alias kept. */
  stars: RatingRow['score']
  /** Not on the list row; the detail row carries `updatedAt`. */
  updatedAt: Schemas['EmployeeRatingRecordDto']['createdAt']
  /** Derived from `OrganizationRatingResponseDto` nested client (name split not exposed). */
  client: { firstName: string; lastName: string } | null
}

/** Star histogram, keyed 1–5. Not a documented type; local to this projection. */
export interface RatingDistribution {
  1: number
  2: number
  3: number
  4: number
  5: number
}

/** NOT derived: `OrganizationRatingsResponseDto` is `{averageRating, items, meta}` with no histogram. */
export interface RatingStats {
  average: number
  total: number
  distribution: RatingDistribution
}

/** NOT derived: the ratings list has no `minStars` filter; date window is not documented. */
export interface RatingListQuery extends PaginationParams {
  minStars?: number
  fromDate?: string
  toDate?: string
}

export type RatingListResponse = PaginatedResponse<EmployeeRating>
