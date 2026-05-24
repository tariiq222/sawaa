import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublicBrandingForSsr } from '@/features/branding/public';
import { getPublicEmployee } from '@/features/therapists/therapists.api';
import { theme } from '@/themes/registry';
import { buildPageMetadata } from '@/lib/seo/page-metadata';
import { getLocale } from '@/features/locale/public';
import { SawaaTherapistProfilePage } from '@/themes/sawaa/pages/therapist-profile';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const branding = await getPublicBrandingForSsr();
  try {
    const therapist = await getPublicEmployee(slug);
    const name = therapist.nameAr ?? therapist.nameEn ?? slug;
    return buildPageMetadata({
      branding,
      path: `/therapists/${slug}`,
      titleAr: name,
      descriptionAr:
        therapist.specialtyAr ??
        therapist.specialty ??
        `${name} - ${branding.organizationNameAr}`,
    });
  } catch {
    return buildPageMetadata({ branding, path: `/therapists/${slug}`, titleAr: slug, descriptionAr: '' });
  }
}

export default async function TherapistProfileRoute({ params }: Props) {
  const { slug } = await params;
  const locale = await getLocale();

  try {
    await getPublicEmployee(slug);
  } catch {
    notFound();
  }

  const Layout = theme.Layout;
  return (
    <Layout>
      <SawaaTherapistProfilePage slug={slug} locale={locale} />
    </Layout>
  );
}
