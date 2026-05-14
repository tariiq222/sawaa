/**
 * Canonical list response shape used by every list endpoint.
 *
 * Rule: every list handler returns `{ items, meta }` — never `{ data }`,
 * never a flat array, never shape-variations. The frontend `PaginatedResponse<T>`
 * type mirrors this exactly.
 */

export interface ListMeta {
  total: number;
  page: number;
  perPage: number;
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
  perPage: number,
): ListResponse<T> {
  const safePerPage = perPage > 0 ? perPage : 1;
  const totalPages = Math.max(1, Math.ceil(total / safePerPage));
  return {
    items,
    meta: {
      total,
      page,
      perPage: safePerPage,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}
