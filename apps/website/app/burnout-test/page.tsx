import type { Metadata } from 'next';
import { getPublicBrandingForSsr } from '@/features/branding/public';
import { themes } from '@/themes/registry';
import { buildPageMetadata } from '@/lib/seo/page-metadata';

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getPublicBrandingForSsr();
  return buildPageMetadata({
    branding,
    path: '/burnout-test',
    titleAr: 'اختبار الإرهاق النفسي',
    descriptionAr: 'قيّم مستوى الإرهاق النفسي خلال دقيقتين، واحصل على توصية فورية تساعدك على اتخاذ الخطوة التالية.',
  });
}

export default async function BurnoutRoute() {
  const branding = await getPublicBrandingForSsr();
  const theme = themes[branding.activeWebsiteTheme];
  const Page = theme.pages.burnoutTest;
  const Layout = theme.Layout;
  return (
    <Layout>
      <Page />
    </Layout>
  );
}
