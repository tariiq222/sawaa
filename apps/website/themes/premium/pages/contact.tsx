import { ContactForm } from '@/features/contact/public';
import { getLocale } from '@/features/locale/public';
import { t } from '@/features/locale/dictionary';

export async function PremiumContactPage() {
  const locale = await getLocale();
  return (
    <main style={{ padding: '5rem 2rem', maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontSize: '3rem', color: 'var(--primary-dark)' }}>{t(locale, 'contact.title')}</h1>
      <p style={{ opacity: 0.7, fontSize: '1.1rem', marginBottom: '3rem' }}>{t(locale, 'contact.description')}</p>
      <ContactForm locale={locale} />
    </main>
  );
}
