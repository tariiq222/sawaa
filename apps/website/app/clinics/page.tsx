import type { Metadata } from 'next';
import { getPublicBrandingForSsr } from '@/features/branding/public';
import { theme } from '@/themes/registry';
import { buildPageMetadata } from '@/lib/seo/page-metadata';

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getPublicBrandingForSsr();
  return buildPageMetadata({
    branding,
    path: '/clinics',
    titleAr: 'العيادات',
    descriptionAr: 'تعرّف على عيادات مركز سواء المتخصصة، واختر العيادة الأنسب لك.',
  });
}

export default function ClinicsRoute() {
  const Page = theme.pages.clinics;
  const Layout = theme.Layout;
  return (
    <Layout>
      <Page />
    </Layout>
  );
}
