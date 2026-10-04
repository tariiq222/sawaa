import { cache } from 'react';
import * as Sentry from '@sentry/nextjs';

import { getApiBase } from '@/lib/api-base';
import type { PublicCatalog } from './types';

const EMPTY_CATALOG: PublicCatalog = {
  departments: [],
  categories: [],
  services: [],
  vatRate: 0,
};

export interface PublicCatalogResult {
  catalog: PublicCatalog;
  /** True when the fetch failed and the catalog is the empty fallback (audit C4). */
  failed: boolean;
}

export const getPublicCatalogResult = cache(
  async function getPublicCatalogResult(): Promise<PublicCatalogResult> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1500);
      const res = await fetch(`${getApiBase()}/public/services?includeDirectClinics=true`, {
        next: { revalidate: 60 },
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));
      if (!res.ok) {
        Sentry.addBreadcrumb({
          category: 'fetch',
          level: 'warning',
          message: '[catalog] fetch failed — using empty catalog',
          data: { status: res.status },
        });
        Sentry.captureMessage('[catalog] fetch failed — using empty catalog', {
          level: 'warning',
          tags: { surface: 'public-catalog' },
          extra: { status: res.status },
        });
        return { catalog: EMPTY_CATALOG, failed: true };
      }
      return { catalog: (await res.json()) as PublicCatalog, failed: false };
    } catch (err) {
      Sentry.addBreadcrumb({
        category: 'fetch',
        level: 'warning',
        message: '[catalog] fetch error — using empty catalog',
        data: { error: err instanceof Error ? err.message : String(err) },
      });
      Sentry.captureException(err, {
        level: 'warning',
        tags: { surface: 'public-catalog' },
      });
      return { catalog: EMPTY_CATALOG, failed: true };
    }
  },
);

export const getPublicCatalog = cache(async function getPublicCatalog(): Promise<PublicCatalog> {
  const { catalog } = await getPublicCatalogResult();
  return catalog;
});
