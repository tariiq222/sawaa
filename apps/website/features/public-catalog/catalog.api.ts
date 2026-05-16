import { getApiBase } from '@/lib/api-base';
import type { PublicCatalog } from './types';

const EMPTY_CATALOG: PublicCatalog = {
  departments: [],
  categories: [],
  services: [],
};

export async function getPublicCatalog(): Promise<PublicCatalog> {
  try {
    const res = await fetch(`${getApiBase()}/public/services`, {
      next: { revalidate: 60, tags: ['public-catalog'] },
    });
    if (!res.ok) {
      console.warn(`[catalog] fetch failed: ${res.status} — using empty catalog`);
      return EMPTY_CATALOG;
    }
    return (await res.json()) as PublicCatalog;
  } catch (err) {
    console.warn('[catalog] fetch error — using empty catalog', err);
    return EMPTY_CATALOG;
  }
}
