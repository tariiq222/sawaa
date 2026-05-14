import type { PublicEmployee } from '@deqah/api-client';

interface Props {
  therapist: PublicEmployee;
  locale: 'ar' | 'en';
}

export function TherapistCard({ therapist, locale }: Props) {
  const name = locale === 'ar' ? therapist.nameAr : therapist.nameEn;
  const specialty = locale === 'ar' ? therapist.specialtyAr : therapist.specialty;
  const bio = locale === 'ar' ? therapist.publicBioAr : therapist.publicBioEn;

  return (
    <article
      style={{
        padding: '1.5rem',
        borderRadius: '1rem',
        background: 'color-mix(in srgb, var(--primary) 4%, transparent)',
        border: '1px solid color-mix(in srgb, var(--primary) 15%, transparent)',
      }}
    >
      {therapist.publicImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={therapist.publicImageUrl}
          alt={name ?? ''}
          style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover', marginBottom: '1rem' }}
        />
      ) : null}
      <h3 style={{ margin: 0, color: 'var(--primary-dark)' }}>{name ?? '—'}</h3>
      {therapist.title ? <p style={{ margin: '0.25rem 0 0', color: 'var(--primary)' }}>{therapist.title}</p> : null}
      {specialty ? <p style={{ margin: '0.25rem 0 0', opacity: 0.8 }}>{specialty}</p> : null}
      {bio ? <p style={{ marginTop: '0.75rem', fontSize: '0.9rem', lineHeight: 1.6 }}>{bio}</p> : null}
      {therapist.slug ? (
        <a
          href={`/therapists/${therapist.slug}`}
          style={{ display: 'inline-block', marginTop: '1rem', color: 'var(--primary)' }}
        >
          {locale === 'ar' ? 'عرض الملف' : 'View profile'} →
        </a>
      ) : null}
    </article>
  );
}
