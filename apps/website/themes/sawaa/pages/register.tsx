import { RegisterForm } from '@/features/auth/public';
import { getLocale } from '@/features/locale/public';
import { t } from '@/features/locale/dictionary';

export async function SawaaRegisterPage() {
  const locale = await getLocale();
  return (
    <main style={{ padding: '4rem 2rem', maxWidth: 480, margin: '0 auto' }}>
      <h1 style={{ color: 'var(--primary-dark)', marginBottom: '0.5rem' }}>
        {t(locale, 'auth.registerTitle')}
      </h1>
      <p style={{ opacity: 0.7, marginBottom: '2rem', fontSize: '0.9375rem' }}>
        {t(locale, 'auth.registerSubtitle')}
      </p>
      <RegisterForm />
      <p style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.875rem', opacity: 0.7 }}>
        {t(locale, 'auth.hasAccount')}{' '}
        <a href="/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>
          {t(locale, 'auth.login')}
        </a>
      </p>
    </main>
  );
}
