import * as Sentry from '@sentry/nextjs';
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
    const all = unwrap<PublicEmployee[]>(json);
    // Hide therapists that aren't actually bookable — no active services,
    // no branch, or no availability rules. Mirrors the booking wizard logic
    // so the directory never shows a card that dead-ends on booking.
    return all.filter((e) => e.isBookable);
  } catch (err) {
    Sentry.addBreadcrumb({
      category: 'fetch',
      level: 'warning',
      message: '[therapists] listPublicEmployees error — using empty list',
      data: { error: err instanceof Error ? err.message : String(err) },
    });
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
