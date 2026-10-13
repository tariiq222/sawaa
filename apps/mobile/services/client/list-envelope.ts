export interface ListMeta {
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function rec(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

/**
 * Reads the canonical `{ items, total, page, pageSize }` list envelope and
 * rebuilds the `meta` block screens consume. The legacy `{ items|data, meta }`
 * envelope is still accepted for one release.
 */
export function readListEnvelope<T>(raw: unknown, fallbackPageSize = 10): { items: T[]; meta: ListMeta } {
  const body = rec(raw);
  const legacy = rec(body.meta);
  const rows = Array.isArray(body.items) ? body.items : Array.isArray(body.data) ? body.data : [];
  const total = num(body.total) ?? num(legacy.total) ?? rows.length;
  const page = num(body.page) ?? num(legacy.page) ?? 1;
  const pageSize = num(body.pageSize) ?? num(legacy.limit) ?? num(legacy.perPage) ?? fallbackPageSize;
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  return {
    items: rows as T[],
    meta: { total, page, perPage: pageSize, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1 },
  };
}
