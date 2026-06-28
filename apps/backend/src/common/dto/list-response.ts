/**
 * Canonical list response shape used by every list endpoint.
 *
 * Rule: every list handler returns `{ items, meta }` — never `{ data }`,
 * never a flat array, never shape-variations. The frontend `PaginatedResponse<T>`
 * type mirrors this exactly.
 */

interface ListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ListResponse<T> {
  items: T[];
  meta: ListMeta;
}

/**
 * Build a canonical list response from raw items + count + page/limit.
 * Use this in every list handler to avoid drift.
 */
export function toListResponse<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
): ListResponse<T> {
  const safeLimit = limit > 0 ? limit : 1;
  const totalPages = Math.max(1, Math.ceil(total / safeLimit));
  return {
    items,
    meta: {
      total,
      page,
      limit: safeLimit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}
