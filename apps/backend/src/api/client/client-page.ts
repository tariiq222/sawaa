import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

/** Canonical paginated body of the /client surface. */
export interface ClientPage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export function toClientPage<T>(items: T[], total: number, page: number, pageSize: number): ClientPage<T> {
  return { items, total, page, pageSize };
}

export const CLIENT_PAGE_SCHEMA: SchemaObject = {
  type: 'object',
  required: ['items', 'total', 'page', 'pageSize'],
  properties: {
    items: { type: 'array', items: { type: 'object' } },
    total: { type: 'integer', minimum: 0 },
    page: { type: 'integer', minimum: 1 },
    pageSize: { type: 'integer', minimum: 1 },
  },
};
