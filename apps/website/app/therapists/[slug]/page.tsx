import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublicBrandingForSsr } from '@/features/branding/public';
import { getPublicEmployee } from '@/features/therapists/therapists.api';
import { themes } from '@/themes/registry';
import { buildPageMetadata } from '@/lib/seo/page-metadata';
import { getLocale } from '@/features/locale/public';

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
      descriptionAr: therapist.specialtyAr ?? therapist.specialty ?? `${name} - ${branding.organizationNameAr}`,
    });
  } catch {
    return buildPageMetadata({ branding, path: `/therapists/${slug}`, titleAr: slug, descriptionAr: '' });
  }
}

export default async function TherapistProfilePage({ params }: Props) {
  const { slug } = await params;
  const locale = await getLocale();

  let therapist;
  try {
    therapist = await getPublicEmployee(slug);
  } catch {
    notFound();
  }

  const branding = await getPublicBrandingForSsr();
  const Layout = themes[branding.activeWebsiteTheme].Layout;

  const name = locale === 'ar' ? (therapist.nameAr ?? therapist.nameEn) : (therapist.nameEn ?? therapist.nameAr);
  const specialty = locale === 'ar' ? (therapist.specialtyAr ?? therapist.specialty) : (therapist.specialty ?? therapist.specialtyAr);
  const bio = locale === 'ar' ? (therapist.publicBioAr ?? therapist.publicBioEn) : (therapist.publicBioEn ?? therapist.publicBioAr);

  return (
    <Layout>
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '4rem 2rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '1.5rem' }}>
          {therapist.publicImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={therapist.publicImageUrl}
              alt={name ?? ''}
              style={{
                width: 160,
                height: 160,
                borderRadius: '50%',
                objectFit: 'cover',
                border: '4px solid color-mix(in srgb, var(--primary) 20%, transparent)',
              }}
            />
          ) : (
            <div
              style={{
                width: 160,
                height: 160,
                borderRadius: '50%',
                background: 'color-mix(in srgb, var(--primary) 12%, transparent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '3rem',
                fontWeight: 700,
                color: 'var(--primary)',
              }}
            >
              {(name ?? '?')[0]}
            </div>
          )}

          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--primary-dark)', margin: 0 }}>
              {name ?? '—'}
            </h1>
            {therapist.title && (
              <p style={{ color: 'var(--primary)', fontWeight: 600, marginTop: '0.5rem', fontSize: '1.125rem' }}>
                {therapist.title}
              </p>
            )}
            {specialty && (
              <p style={{ opacity: 0.8, marginTop: '0.25rem' }}>{specialty}</p>
            )}
          </div>
        </div>

        {bio && (
          <div
            style={{
              marginTop: '2.5rem',
              padding: '2rem',
              borderRadius: '1rem',
              background: 'color-mix(in srgb, var(--primary) 4%, transparent)',
              border: '1px solid color-mix(in srgb, var(--primary) 12%, transparent)',
              lineHeight: 1.8,
              fontSize: '1rem',
            }}
          >
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--primary-dark)', marginBottom: '1rem' }}>
              {locale === 'ar' ? 'نبذة' : 'About'}
            </h2>
            <p style={{ whiteSpace: 'pre-line' }}>{bio}</p>
          </div>
        )}

        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <a
            href="/booking"
            style={{
              display: 'inline-block',
              padding: '0.875rem 2.5rem',
              background: 'var(--primary)',
              color: 'var(--on-primary, #fff)',
              borderRadius: '999px',
              fontWeight: 600,
              textDecoration: 'none',
              fontSize: '1rem',
            }}
          >
            {locale === 'ar' ? 'احجز موعدك' : 'Book Appointment'}
          </a>
        </div>

        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          <a
            href="/therapists"
            style={{ color: 'var(--primary)', fontSize: '0.9375rem' }}
          >
            {locale === 'ar' ? '← جميع المعالجين' : '← All Therapists'}
          </a>
        </div>
      </main>
    </Layout>
  );
}
