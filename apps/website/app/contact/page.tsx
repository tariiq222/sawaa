import type { Metadata } from 'next';
import { getPublicBrandingForSsr } from '@/features/branding/public';
import { themes } from '@/themes/registry';
import { buildPageMetadata } from '@/lib/seo/page-metadata';

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getPublicBrandingForSsr();
  return buildPageMetadata({
    branding,
    path: '/contact',
    titleAr: 'تواصل معنا',
    descriptionAr: 'أرسل استفسارك أو ملاحظتك وسنعود إليك خلال يوم عمل واحد.',
  });
}

export default async function ContactRoute() {
  const branding = await getPublicBrandingForSsr();
  const theme = themes[branding.activeWebsiteTheme];
  const Page = theme.pages.contact;
  const Layout = theme.Layout;
  return (
    <Layout>
      <Page />
    </Layout>
  );
}
