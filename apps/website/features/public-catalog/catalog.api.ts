import { getApiBase } from '@/lib/api-base';
import type { PublicCatalog } from './types';

export async function getPublicCatalog(): Promise<PublicCatalog> {
  const res = await fetch(`${getApiBase()}/public/services`, {
    next: { revalidate: 60, tags: ['public-catalog'] },
  });
  if (!res.ok) throw new Error(`Failed to fetch catalog: ${res.status}`);
  return res.json() as Promise<PublicCatalog>;
}
