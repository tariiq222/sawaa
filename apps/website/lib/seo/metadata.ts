import type { Metadata } from 'next';

export interface PageMetadataOptions {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
  noIndex?: boolean;
}

export function buildPageMetadata(options: PageMetadataOptions): Metadata {
  const baseUrl = process.env.NEXT_PUBLIC_WEBSITE_URL ?? 'https://example.com';

  return {
    title: options.title,
    description: options.description,
    alternates: options.canonical
      ? { canonical: `${baseUrl}${options.canonical}` }
      : undefined,
    openGraph: {
      title: options.title,
      description: options.description,
      url: options.canonical ? `${baseUrl}${options.canonical}` : undefined,
      images: options.ogImage
        ? [{ url: `${baseUrl}${options.ogImage}`, width: 1200, height: 630 }]
        : undefined,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: options.title,
      description: options.description,
      images: options.ogImage ? [`${baseUrl}${options.ogImage}`] : undefined,
    },
    robots: options.noIndex ? { index: false, follow: false } : undefined,
  };
}