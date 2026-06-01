import type { Metadata } from 'next';
import { getPublicBrandingForSsr } from '@/features/branding/public';
import {
  fetchSiteSettingsMap,
  resolveBlogPosts,
  resolveSectionIntros,
} from '@/features/site-content/public';
import { getLocale } from '@/features/locale/public';
import { buildPageMetadata } from '@/lib/seo/page-metadata';
import { theme } from '@/themes/registry';
import { Blog } from '@/themes/sawaa/components/sections/blog';

function introTitle(intro: { titlePrefix: string; titleHighlight: string; titleSuffix: string }): string {
  return [intro.titlePrefix, intro.titleHighlight, intro.titleSuffix]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(' ');
}

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getPublicBrandingForSsr();
  const settings = await fetchSiteSettingsMap().catch(() => new Map());
  const locale = await getLocale();
  const intro = resolveSectionIntros(settings, locale).blog;

  return buildPageMetadata({
    branding,
    path: '/blog',
    titleAr: introTitle(intro),
    descriptionAr: intro.subtitle,
  });
}

export default async function BlogIndexRoute() {
  const settings = await fetchSiteSettingsMap().catch(() => new Map());
  const locale = await getLocale();
  const intro = resolveSectionIntros(settings, locale).blog;
  const posts = resolveBlogPosts(settings);
  const Layout = theme.Layout;

  return (
    <Layout>
      <Blog intro={intro} items={posts} />
    </Layout>
  );
}
