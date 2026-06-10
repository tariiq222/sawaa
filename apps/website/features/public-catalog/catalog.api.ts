import * as Sentry from '@sentry/nextjs';

import { getApiBase } from '@/lib/api-base';
import type { PublicCatalog } from './types';

const EMPTY_CATALOG: PublicCatalog = {
  departments: [],
  categories: [],
  services: [],
  vatRate: 0,
};

export async function getPublicCatalog(): Promise<PublicCatalog> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${getApiBase()}/public/services`, {
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
      return EMPTY_CATALOG;
    }
    return (await res.json()) as PublicCatalog;
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
    return EMPTY_CATALOG;
  }
}
