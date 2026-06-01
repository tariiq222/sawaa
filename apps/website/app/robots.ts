import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

const BASE_URL = process.env.NEXT_PUBLIC_WEBSITE_URL ?? 'https://sawaa.sa';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/account/', '/api/'],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}