import { ContactForm } from '@/features/contact/public';
import { getLocale } from '@/features/locale/public';
import { t } from '@/features/locale/dictionary';

export async function SawaaContactPage() {
  const locale = await getLocale();
  return (
    <main style={{ padding: '4rem 2rem', maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ color: 'var(--primary-dark)' }}>{t(locale, 'contact.title')}</h1>
      <p style={{ opacity: 0.8, marginBottom: '2rem' }}>{t(locale, 'contact.description')}</p>
      <ContactForm locale={locale} />
    </main>
  );
}
