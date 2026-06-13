import type { Metadata } from 'next';
import { getPublicBrandingForSsr } from '@/features/branding/public';
import {
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
  const locale = await getLocale();
  const intro = resolveSectionIntros(locale).blog;

  return buildPageMetadata({
    branding,
    path: '/blog',
    titleAr: introTitle(intro),
    descriptionAr: intro.subtitle,
  });
}

export default async function BlogIndexRoute() {
  const locale = await getLocale();
  const intro = resolveSectionIntros(locale).blog;
  const posts = resolveBlogPosts();
  const Layout = theme.Layout;

  return (
    <Layout>
      <div className="-mt-[88px] pt-[88px]" style={{ background: '#FBF7F2' }}>
        <Blog intro={intro} items={posts} />
      </div>
    </Layout>
  );
}
