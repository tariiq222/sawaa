import type { Metadata } from 'next';

import { getPublicBrandingForSsr } from '@/features/branding/public';
import { buildPageMetadata } from '@/lib/seo/page-metadata';
import { theme } from '@/themes/registry';

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getPublicBrandingForSsr();
  return buildPageMetadata({
    branding,
    path: '/packages',
    titleAr: 'الباقات العلاجية',
    descriptionAr: 'تعرّف على باقات الجلسات في مركز سواء وتفاصيل كل باقة وعدد جلساتها وسعرها.',
    titleEn: 'Therapy packages',
    descriptionEn: 'Explore Sawaa session packages, including the number of sessions and price of each.',
  });
}

export default function PackagesPage() {
  const Layout = theme.Layout;
  return <Layout><theme.pages.packages /></Layout>;
}
