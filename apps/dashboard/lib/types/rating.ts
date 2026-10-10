/**
 * Rating Types — Sawaa Dashboard
 */

import type { PaginatedQuery } from "./common"

/* ─── Entities ─── */

export interface Rating {
  employee?: { id: string; name: string; nameEn?: string | null } | null
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
