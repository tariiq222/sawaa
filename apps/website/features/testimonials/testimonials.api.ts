import * as Sentry from '@sentry/nextjs';
import { publicFetch } from '@/lib/public-fetch';

export interface PublicTestimonial {
  id: string;
  text: string;
  name: string;
  letter: string;
  rating: number;
  date: string;
}

export async function listPublicTestimonials(limit = 6): Promise<PublicTestimonial[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const json = await publicFetch<PublicTestimonial[] | { data?: PublicTestimonial[] }>(
      `/public/testimonials?limit=${limit}`,
      { next: { revalidate: 60, tags: ['public-testimonials'] }, signal: controller.signal },
    ).finally(() => clearTimeout(timer));
    const data = Array.isArray(json) ? json : json.data ?? [];
    return data;
  } catch (err) {
    Sentry.addBreadcrumb({
      category: 'fetch',
      level: 'warning',
      message: '[testimonials] fetch error — using empty list',
      data: { error: err instanceof Error ? err.message : String(err) },
    });
    return [];
  }
}
