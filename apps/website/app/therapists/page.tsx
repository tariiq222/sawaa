import type { Metadata } from 'next';
import { getPublicBrandingForSsr } from '@/features/branding/public';
import { theme } from '@/themes/registry';
import { buildPageMetadata } from '@/lib/seo/page-metadata';

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getPublicBrandingForSsr();
  return buildPageMetadata({
    branding,
    path: '/therapists',
    titleAr: 'الأخصائيون',
    descriptionAr: 'تعرّف على فريق الأخصائيين المعتمدين واحجز موعدك مع المتخصص المناسب لك.',
  });
}

export default async function TherapistsRoute() {
  const Page = theme.pages.therapists;
  const Layout = theme.Layout;
  return (
    <Layout>
      <Page />
    </Layout>
  );
}
