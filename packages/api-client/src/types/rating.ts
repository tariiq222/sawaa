import type { PaginatedResponse, PaginationParams } from './api'

export interface EmployeeRating {
  id: string
  bookingId: string
  clientId: string | null
  employeeId: string
  stars: number
  comment: string | null
  createdAt: string
  updatedAt: string
  client: {
    firstName: string
    lastName: string
  } | null
}

export interface RatingDistribution {
  1: number
  2: number
  3: number
  4: number
  5: number
}

export interface RatingStats {
  average: number
  total: number
  distribution: RatingDistribution
}

export interface RatingListQuery extends PaginationParams {
  minStars?: number
  fromDate?: string
  toDate?: string
}

export type RatingListResponse = PaginatedResponse<EmployeeRating>
