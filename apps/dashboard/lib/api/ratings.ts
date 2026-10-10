import { api } from '@/lib/api'
import type { Rating } from '@/lib/types/rating'
import type { PaginatedResponse } from '@/lib/types/common'
export type RatingsResponse = PaginatedResponse<Rating> & { averageRating?: number | null }
export async function fetchAllRatings(query: { page?: number; limit?: number } = {}): Promise<RatingsResponse> {
  const response = await api.get<PaginatedResponse<Omit<Rating, 'stars'> & { score?: number; stars?: number }> & { averageRating?: number | null }>('/dashboard/organization/ratings', query)
  return { ...response, items: response.items.map(r => ({ ...r, stars: r.stars ?? r.score ?? 0 })) }
}
export async function updateRatingVisibility(id: string, isPublic: boolean): Promise<void> {
  await api.patch(`/dashboard/organization/ratings/${id}/visibility`, { isPublic })
}
