import { listPublicEmployees, TherapistCard } from '@/features/therapists/public';
import { getLocale } from '@/features/locale/public';
import { t } from '@/features/locale/dictionary';

export async function SawaaTherapistsPage() {
  const locale = await getLocale();
  const therapists = await listPublicEmployees();

  return (
    <main style={{ padding: '4rem 2rem', maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ color: 'var(--primary-dark)', marginBottom: '2rem' }}>{t(locale, 'therapists.title')}</h1>
      {therapists.length === 0 ? (
        <p style={{ opacity: 0.7 }}>{t(locale, 'therapists.empty')}</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {therapists.map((t2) => <TherapistCard key={t2.id} therapist={t2} locale={locale} />)}
        </div>
      )}
    </main>
  );
}
