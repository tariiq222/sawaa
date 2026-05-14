import type { MetadataRoute } from 'next';
import { listPublicEmployees } from '@/features/therapists/public';

const BASE_URL = process.env.NEXT_PUBLIC_WEBSITE_URL ?? 'https://example.com';

const STATIC_ROUTES: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
  priority: number;
}> = [
  { path: '', changeFrequency: 'weekly', priority: 1.0 },
  { path: '/therapists', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/booking', changeFrequency: 'monthly', priority: 0.9 },
  { path: '/support-groups', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/contact', changeFrequency: 'yearly', priority: 0.5 },
  { path: '/burnout-test', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/login', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/register', changeFrequency: 'yearly', priority: 0.4 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = STATIC_ROUTES.map(({ path, changeFrequency, priority }) => ({
    url: `${BASE_URL}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }));

  const therapists = await listPublicEmployees().catch(() => []);
  for (const therapist of therapists) {
    if (!therapist.slug) continue;
    entries.push({
      url: `${BASE_URL}/therapists/${encodeURIComponent(therapist.slug)}`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    });
  }

  return entries;
}
