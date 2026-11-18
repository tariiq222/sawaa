import type { components } from './generated/openapi'

type Schemas = components['schemas']

/**
 * Pagination envelope. Derived from the documented `ListMetaDto` — every
 * paginated dashboard response embeds this exact object as `meta`.
 */
export type PaginationMeta = Schemas['ListMetaDto']

/**
 * Generic page envelope. The snapshot documents each concrete page separately
 * (`PaginatedBranchesDto`, `InvoiceListResponseDto`, …) but they all share
 * this exact `{ items, meta }` shape, so the generic is expressed with the
 * derived meta instead of re-declaring its fields.
 */
export interface PaginatedResponse<T> {
  items: T[]
  meta: PaginationMeta
}

/**
 * Shared query-string paging controls. Kept local: the snapshot documents
 * paging as inline per-operation parameters, not as a reusable DTO, and only
 * `PaginationParams` consumers (`*ListQuery`) combine them with per-route
 * filters.
 */
export interface PaginationParams {
  page?: number
  limit?: number
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export function buildQueryString(params: Record<string, unknown>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    search.set(key, String(value))
  }
  const s = search.toString()
  return s ? `?${s}` : ''
}
