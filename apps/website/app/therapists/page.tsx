import type { Metadata } from 'next';
import { getPublicBrandingForSsr } from '@/features/branding/public';
import { theme } from '@/themes/registry';
import { buildPageMetadata } from '@/lib/seo/page-metadata';

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getPublicBrandingForSsr();
  return buildPageMetadata({
    branding,
    path: '/therapists',
    titleAr: 'المعالجون',
    descriptionAr: 'تعرّف على فريق المعالجين المعتمدين واحجز موعدك مع المعالج المناسب لك.',
  });
}

interface TherapistsRouteProps {
  searchParams: Promise<{ specialty?: string }>;
}

export default async function TherapistsRoute({ searchParams }: TherapistsRouteProps) {
  const Page = theme.pages.therapists;
  const Layout = theme.Layout;
  const { specialty } = await searchParams;
  return (
    <Layout>
      <Page initialSpecialty={specialty ?? null} />
    </Layout>
  );
}
