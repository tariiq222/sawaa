import { apiRequest } from '../client'
import { buildQueryString } from '../types/api'
import type {
  RatingListQuery,
  RatingListResponse,
} from '../types/rating'

export async function listForEmployee(
  employeeId: string,
  query: RatingListQuery = {},
): Promise<RatingListResponse> {
  return apiRequest<RatingListResponse>(
    `/employees/${employeeId}/ratings${buildQueryString(query as Record<string, unknown>)}`,
  )
}
