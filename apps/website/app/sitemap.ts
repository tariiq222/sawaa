import type { MetadataRoute } from 'next';
import { listPublicEmployees } from '@/features/therapists/public';

export const revalidate = 3600;
export const dynamic = 'force-static';

const BASE_URL = process.env.NEXT_PUBLIC_WEBSITE_URL ?? 'https://sawaa.sa';

const STATIC_ROUTES: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
  priority: number;
}> = [
  { path: '', changeFrequency: 'weekly', priority: 1.0 },
  { path: '/therapists', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/booking', changeFrequency: 'monthly', priority: 0.9 },
  { path: '/support-groups', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/about', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/blog', changeFrequency: 'weekly', priority: 0.6 },
  { path: '/contact', changeFrequency: 'yearly', priority: 0.5 },
  { path: '/burnout-test', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/login', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/register', changeFrequency: 'yearly', priority: 0.4 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = STATIC_ROUTES.map(({ path, changeFrequency, priority }) => {
    const url = `${BASE_URL}${path}`;
    return {
      url,
      lastModified: now,
      changeFrequency,
      priority,
      // Bilingual site serves the same URL to both locales via cookie;
      // declaring hreflang here is a strong signal for Google to surface
      // the right language version in search results.
      alternates: {
        languages: {
          'ar-SA': url,
          en: url,
          'x-default': url,
        },
      },
    };
  });

  const therapists = await listPublicEmployees().catch(() => []);
  for (const therapist of therapists) {
    if (!therapist.slug) continue;
    const url = `${BASE_URL}/therapists/${encodeURIComponent(therapist.slug)}`;
    entries.push({
      url,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
      alternates: {
        languages: {
          'ar-SA': url,
          en: url,
          'x-default': url,
        },
      },
    });
  }

  return entries;
}
