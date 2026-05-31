import type { Metadata } from 'next';
import { getPublicBrandingForSsr } from '@/features/branding/public';
import { theme } from '@/themes/registry';
import { TermsPage } from '@/themes/sawaa/components/legal/legal-page';
import { buildPageMetadata } from '@/lib/seo/page-metadata';

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getPublicBrandingForSsr();
  return buildPageMetadata({
    branding,
    path: '/terms',
    titleAr: 'الشروط والأحكام',
    descriptionAr:
      'شروط استخدام خدمات مركز سواء، وأحكام الحجز والدفع والإلغاء، ومسؤوليات المستخدم، والقانون الحاكم في المملكة العربية السعودية.',
  });
}

export default function TermsRoute() {
  const Layout = theme.Layout;
  return (
    <Layout>
      <TermsPage />
    </Layout>
  );
}
