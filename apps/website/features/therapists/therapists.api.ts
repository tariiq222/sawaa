import type { PublicEmployee } from '@sawaa/api-client';

import { publicFetch } from '@/lib/public-fetch';

function unwrap<T>(json: unknown): T {
  if (json && typeof json === 'object' && 'data' in json) {
    return (json as { data: T }).data;
  }
  return json as T;
}

export async function listPublicEmployees(): Promise<PublicEmployee[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const json = await publicFetch<unknown>('/public/employees', {
      next: { revalidate: 60, tags: ['public-employees'] },
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
    return unwrap<PublicEmployee[]>(json);
  } catch (err) {
    console.warn('[therapists] listPublicEmployees error — using empty list', err);
    return [];
  }
}

export async function getPublicEmployee(slug: string): Promise<PublicEmployee> {
  const json = await publicFetch<unknown>(
    `/public/employees/${encodeURIComponent(slug)}`,
    { next: { revalidate: 60, tags: ['public-employees', `employee-${slug}`] } },
  );
  return unwrap<PublicEmployee>(json);
}
