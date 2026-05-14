import type { PublicEmployee } from '@deqah/api-client';

import { publicFetch } from '@/lib/public-fetch';

function unwrap<T>(json: unknown): T {
  if (json && typeof json === 'object' && 'data' in json) {
    return (json as { data: T }).data;
  }
  return json as T;
}

export async function listPublicEmployees(): Promise<PublicEmployee[]> {
  const json = await publicFetch<unknown>('/public/employees', {
    next: { revalidate: 60, tags: ['public-employees'] },
  });
  return unwrap<PublicEmployee[]>(json);
}

export async function getPublicEmployee(slug: string): Promise<PublicEmployee> {
  const json = await publicFetch<unknown>(
    `/public/employees/${encodeURIComponent(slug)}`,
    { next: { revalidate: 60, tags: ['public-employees', `employee-${slug}`] } },
  );
  return unwrap<PublicEmployee>(json);
}
