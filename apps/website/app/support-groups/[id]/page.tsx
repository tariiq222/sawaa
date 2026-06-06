import type { Metadata } from 'next';
import { getPublicBrandingForSsr } from '@/features/branding/public';
import { theme } from '@/themes/registry';
import { SawaaSupportGroupDetailPage } from '@/themes/sawaa/pages/support-group-detail';
import { buildPageMetadata } from '@/lib/seo/page-metadata';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getPublicBrandingForSsr();
  return buildPageMetadata({
    branding,
    path: '/support-groups',
    titleAr: 'الدعم الجماعي',
    descriptionAr: 'تفاصيل برنامج الدعم الجماعي والجلسات المتاحة في مركز سواء.',
  });
}

export default async function SupportGroupDetailRoute({ params }: Props) {
  const { id } = await params;
  const Layout = theme.Layout;
  return (
    <Layout>
      <SawaaSupportGroupDetailPage id={id} />
    </Layout>
  );
}
