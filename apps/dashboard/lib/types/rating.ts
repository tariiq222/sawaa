/**
 * Rating Types — Sawaa Dashboard
 */

import type { PaginatedQuery } from "./common"

/* ─── Entities ─── */

export interface Rating {
  id: string
  bookingId: string
  stars: number
  comment: string | null
  isPublic: boolean
  createdAt: string
  client?: {
    id: string
    name: string
  } | null
}

/* ─── Query ─── */

export type RatingListQuery = PaginatedQuery
