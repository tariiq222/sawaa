import { listPublicEmployees, TherapistCard } from '@/features/therapists/public';
import { getLocale } from '@/features/locale/public';
import { t } from '@/features/locale/dictionary';

export async function PremiumTherapistsPage() {
  const locale = await getLocale();
  const therapists = await listPublicEmployees();

  return (
    <main style={{ padding: '5rem 2rem', maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontSize: '3rem', color: 'var(--primary-dark)', letterSpacing: '-0.02em' }}>
        {t(locale, 'therapists.title')}
      </h1>
      {therapists.length === 0 ? (
        <p style={{ opacity: 0.6, marginTop: '2rem' }}>{t(locale, 'therapists.empty')}</p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '2rem',
            marginTop: '3rem',
          }}
        >
          {therapists.map((t2) => <TherapistCard key={t2.id} therapist={t2} locale={locale} />)}
        </div>
      )}
    </main>
  );
}
